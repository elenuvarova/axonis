import os
from contextlib import asynccontextmanager
import html
import re
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from database import engine, db_kind, check_connection, Base
import models  # registers tables with Base


def fail_interrupted_builds() -> int:
    """Builds run as in-process background tasks, so a restart (a deploy, an
    OOM kill) loses them. Their projects would otherwise sit in 'building'
    forever and the screen would poll for nothing. Mark them failed with a
    reason, so they can simply be rebuilt."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        stale = db.query(models.ResearchProject).filter_by(status="building").all()
        for p in stale:
            p.status = "error"
            p.error_message = "The build was interrupted by a server restart. Rebuild to try again."
        db.commit()
        return len(stale)
    finally:
        db.close()


# Postgres doesn't index foreign keys by itself, and every map read filters by
# project_id. create_all only adds indexes to new tables, so existing tables
# get them here; IF NOT EXISTS makes it a no-op after the first start.
_INDEXES = [
    ("ix_entities_project_id", "entities", "project_id"),
    ("ix_relationships_project_id", "relationships", "project_id"),
    ("ix_relationships_source_id", "relationships", "source_id"),
    ("ix_relationships_target_id", "relationships", "target_id"),
    ("ix_clusters_project_id", "clusters", "project_id"),
    ("ix_opportunities_project_id", "opportunities", "project_id"),
    ("ix_opportunities_cluster_db_id", "opportunities", "cluster_db_id"),
]


def ensure_indexes() -> None:
    from sqlalchemy import text
    with engine.begin() as conn:
        for name, table, col in _INDEXES:
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({col})"))


def ensure_columns() -> None:
    """create_all doesn't add columns to existing tables; add the few that
    arrived later. Plain ALTER works on both SQLite and Postgres."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    have = {c["name"] for c in insp.get_columns("research_projects")}
    if "owner_token_hash" not in have:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE research_projects ADD COLUMN owner_token_hash VARCHAR(64)"))
    if "label" not in {c["name"] for c in insp.get_columns("clusters")}:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE clusters ADD COLUMN label VARCHAR(120)"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    ensure_indexes()
    print(f"db: {db_kind}")
    n = fail_interrupted_builds()
    if n:
        print(f"[startup] marked {n} interrupted build(s) as failed")
    yield


# No public API explorer in production: it maps the whole surface for nobody
# who needs it (the README documents the routes).
_prod = os.getenv("NODE_ENV") == "production"
app = FastAPI(title="Axonis", lifespan=lifespan,
              docs_url=None if _prod else "/docs", redoc_url=None if _prod else "/redoc",
              openapi_url=None if _prod else "/openapi.json")

# Reject oversized bodies before they are read. Uploads are capped at 5 MB
# after reading, but FastAPI parses the whole multipart form first, so without
# this a multi-GB POST would be buffered to disk or memory.
_MAX_BODY = 6 * 1024 * 1024


@app.middleware("http")
async def limit_body(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        length = request.headers.get("content-length")
        if length is None and request.headers.get("transfer-encoding", "").lower() == "chunked":
            return JSONResponse({"detail": "Length required"}, status_code=411)
        if length is not None and (not length.isdigit() or int(length) > _MAX_BODY):
            return JSONResponse({"detail": "Request too large (max 5 MB)"}, status_code=413)
    return await call_next(request)


# ── Security headers ──────────────────────────────────────────────────────
# The app serves its own SPA + API from one origin behind an HTTPS proxy, so
# set a conservative baseline on every response. The CSP allows inline scripts
# (the pre-paint theme switcher in index.html) and inline styles (React
# style={{…}}), blob: workers for the cola graph layout, and the self-hosted
# Umami analytics goes through this origin (/s/, routers/stats.py).
_CSP = (
    "default-src 'self'; "
    # Microsoft Clarity (session analytics): its loader on www.clarity.ms, the
    # recorder on scripts.clarity.ms, beacons to *.clarity.ms and c.bing.com.
    "script-src 'self' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https://*.clarity.ms https://c.bing.com; "
    "font-src 'self'; "
    "connect-src 'self' https://*.clarity.ms https://c.bing.com; "
    "worker-src 'self' blob:; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'"
)


_CANONICAL = "https://axonis.app"


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = _CSP
    if os.getenv("NODE_ENV") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


from routers import projects, graph, stats  # noqa: E402 — after app is defined
import og  # noqa: E402
app.include_router(projects.router, prefix="/api")
app.include_router(graph.router, prefix="/api")
app.include_router(og.router, prefix="/api")
app.include_router(stats.router)


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health():
    try:
        check_connection()
        return {"status": "ok", "db": db_kind}
    except Exception as exc:
        # Log the detail server-side; don't leak DB/internal error text to clients.
        print(f"[health] check failed: {exc}")
        raise HTTPException(status_code=500, detail="Database connection failed")


# --- Static frontend (production only) ---
_public = os.path.join(os.path.dirname(__file__), "public")
_UUID = re.compile(r"^project/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/?$")


class ImmutableStatic(StaticFiles):
    """Vite fingerprints everything under /assets, so a file never changes
    under the same name: let browsers keep it for a year without revalidating."""
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def _project_page_meta(project_id: str):
    """(exists, topic-if-public-demo) for a /project/<id> URL."""
    from database import SessionLocal
    from guard import is_protected
    db = SessionLocal()
    try:
        p = db.get(models.ResearchProject, project_id)
        if not p:
            return False, None
        return True, (p.topic if is_protected(project_id) else None)
    finally:
        db.close()


def _shell(public: str, topic: str | None = None, project_id: str | None = None, noindex: bool = False) -> str:
    """index.html, with the demo map's own title, description and URL baked
    in for a public demo. Crawlers and link unfurlers (Slack, LinkedIn, X)
    don't run JS, so without this every shared demo link previews as the
    home page. Visitors' own maps keep the generic head: their topics stay
    private, and `noindex` keeps search engines from listing them."""
    with open(os.path.join(public, "index.html"), encoding="utf-8") as f:
        page = f.read()
    if noindex:
        page = page.replace("</head>", '<meta name="robots" content="noindex" />\n</head>', 1)
    if not topic:
        return page
    t = html.escape(topic)
    # Same wording as the client sets (ProjectPage useDocumentMeta).
    title = f"{t} — knowledge map · Axonis"
    desc = (f"An interactive knowledge graph of {t}: concepts, research and organisations from "
            f"Wikidata and OpenAlex, clustered and scored for product opportunities.")
    url = f"{_CANONICAL}/project/{project_id}"

    def put(pattern, value, text):
        # A function replacement, so nothing in the value is read as a backreference.
        return re.sub(pattern, lambda m: m.group(1) + value, text, count=1, flags=re.S)

    page = put(r"(<title>).*?(?=</title>)", title, page)
    page = put(r'(<link rel="canonical" href=")[^"]*', url, page)
    page = put(r'(<meta property="og:url" content=")[^"]*', url, page)
    for attr in ('property="og:title"', 'name="twitter:title"'):
        page = put(rf'(<meta {attr} content=")[^"]*', title, page)
    for attr in ('name="description"', 'property="og:description"', 'name="twitter:description"'):
        page = put(rf'({attr}\s+content=")[^"]*', desc, page)
    # The map's own card (backend/og.py), demo maps only: this branch is only
    # reached for a public demo.
    img = f"{_CANONICAL}/api/og/{project_id}.png"
    for attr in ('property="og:image"', 'name="twitter:image"'):
        page = put(rf'(<meta {attr} content=")[^"]*', img, page)
    page = put(r'(<meta property="og:image:alt" content=")[^"]*', f"Knowledge map of {t}: its top concepts and the strongest product gap", page)
    return page


def _sitemap() -> str:
    """The home page and every demo map that exists, dated by its last
    rebuild. Built from PROTECTED_PROJECT_IDS, so it can't drift from it."""
    from database import SessionLocal
    from guard import protected_ids
    urls = [(f"{_CANONICAL}/", None)]
    db = SessionLocal()
    try:
        for pid in sorted(protected_ids()):
            p = db.get(models.ResearchProject, pid)
            if p and p.status == "ready":
                stamp = p.updated_at or p.created_at
                urls.append((f"{_CANONICAL}/project/{pid}", stamp.date().isoformat() if stamp else None))
    finally:
        db.close()
    rows = "".join(
        f"  <url><loc>{loc}</loc>{f'<lastmod>{mod}</lastmod>' if mod else ''}</url>\n" for loc, mod in urls
    )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "</urlset>\n")


def mount_frontend(app: FastAPI, public: str) -> None:
    """Serve the built SPA from `public` (production only; tests call it on a scratch app)."""
    _assets = os.path.join(public, "assets")
    if os.path.isdir(_assets):
        app.mount("/assets", ImmutableStatic(directory=_assets), name="assets")

    @app.api_route("/sitemap.xml", methods=["GET", "HEAD"], include_in_schema=False)
    async def sitemap():
        return Response(_sitemap(), media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def spa_fallback(full_path: str):
        # An unknown API path is a JSON 404, never the HTML shell.
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        # Real static files at the web root (favicon, manifest, icons,
        # robots.txt …). The resolved path is confined to the public
        # directory against traversal.
        if full_path and full_path != "index.html":
            candidate = os.path.normpath(os.path.join(public, full_path))
            if candidate.startswith(public + os.sep) and os.path.isfile(candidate):
                return FileResponse(candidate, headers={"Cache-Control": "public, max-age=86400"})
        # The shell must always be revalidated: it names the current asset hashes.
        no_cache = {"Cache-Control": "no-cache"}
        # Only the home page and the demo maps are worth a search result.
        hidden = {**no_cache, "X-Robots-Tag": "noindex"}
        if full_path in ("", "index.html"):
            return HTMLResponse(_shell(public), headers=no_cache)
        m = _UUID.match(full_path)
        if m:
            exists, topic = _project_page_meta(m.group(1))
            # A missing map still gets the shell (it shows its own message),
            # but with a 404 status so it isn't indexed as a page.
            return HTMLResponse(_shell(public, topic, m.group(1), noindex=not topic),
                                status_code=200 if exists else 404, headers=no_cache if topic else hidden)
        return HTMLResponse(_shell(public, noindex=True), status_code=404, headers=hidden)


if os.getenv("NODE_ENV") == "production" and os.path.isdir(_public):
    mount_frontend(app, _public)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "3001"))
    reload = os.getenv("NODE_ENV") != "production"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
