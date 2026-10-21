import hashlib
import hmac
import secrets
from collections import OrderedDict

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Header
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from database import get_db, SessionLocal
from graph import progress
from guard import forbid_if_protected, is_protected, protected_ids, rate_limit, spend
from models import ResearchProject, Entity, Relationship, Cluster, Opportunity
from graph.builder import build_project_graph

_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_EXT = (".pdf", ".csv", ".txt", ".md")

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    region: Optional[str] = Field(default=None, max_length=100)
    goal: Optional[str] = Field(default=None, max_length=200)


class AskRequest(BaseModel):
    # Long enough for any real question; caps what one request can send to the LLM.
    question: str = Field(max_length=1000)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def require_owner(project: ResearchProject, token: Optional[str]) -> None:
    """With no accounts, the browser that created a map holds its owner token
    (returned once by create). Rebuild, upload and delete need it, so sharing
    a map's link no longer lets the recipient wipe or overwrite it. Maps made
    before owner tokens have no owner and are read-only: anyone holding the
    link could otherwise delete them."""
    if project.owner_token_hash is None:
        raise HTTPException(status_code=403, detail="This map was made before maps had owners and can't be changed. Build a new one from the home page.")
    if not token or not hmac.compare_digest(_hash(token), project.owner_token_hash):
        raise HTTPException(status_code=403, detail="Only the browser that created this map can change it. Build your own from the home page.")


@router.post("", status_code=201, dependencies=[Depends(rate_limit("create"))])
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    token = secrets.token_urlsafe(24)
    project = ResearchProject(topic=body.topic.strip(), region=body.region, goal=body.goal,
                              owner_token_hash=_hash(token))
    db.add(project)
    db.commit()
    db.refresh(project)
    # The only time the token leaves the server; only its hash is stored.
    return {**_project_out(project), "owner_token": token}


@router.get("")
def list_projects(mine: Optional[str] = None, db: Session = Depends(get_db)):
    """The public list is the demo maps plus the caller's own projects (ids the
    browser remembers, sent as ?mine=a,b,c). With no accounts, listing every
    visitor's projects to everyone leaked their topics and buried the demos.
    Any project still opens by its URL. With no demos configured (local dev,
    tests) everything is listed, as before."""
    query = db.query(ResearchProject).order_by(ResearchProject.created_at.desc())
    demos = protected_ids()
    if not demos:
        return [_project_out(p) for p in query.all()]
    own = {i.strip() for i in (mine or "").split(",") if i.strip()}
    own = set(list(own)[:100])
    wanted = demos | own
    return [_project_out(p) for p in query.filter(ResearchProject.id.in_(wanted)).all()]


@router.get("/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    return _project_out(project)


@router.post("/{project_id}/build", dependencies=[Depends(rate_limit("build"))])
def trigger_build(project_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db),
                  x_owner_token: Optional[str] = Header(default=None)):
    project = _get_or_404(project_id, db)
    forbid_if_protected(project_id, "rebuilding")
    require_owner(project, x_owner_token)
    if project.status == "building":
        return {"status": "already_building"}
    spend("build")
    project.status = "building"
    db.commit()
    progress.clear_upload(project_id)
    background_tasks.add_task(_run_build, project_id)
    return {"status": "building", "project_id": project_id}


# project_id → (version_key, payload). Cleared implicitly when the project's
# updated_at changes (i.e. after any rebuild/upload), so the LLM brief is only
# regenerated when the underlying graph actually changed. Bounded: least
# recently used briefs drop out first.
_brief_cache: OrderedDict = OrderedDict()
_BRIEF_CACHE_MAX = 200


@router.get("/{project_id}/brief", dependencies=[Depends(rate_limit("brief"))])
def get_brief(project_id: str, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    if project.status != "ready":
        raise HTTPException(status_code=400, detail="Project is not ready yet")

    version = project.updated_at.isoformat() if project.updated_at else ""
    cached = _brief_cache.get(project_id)
    if cached and cached[0] == version:
        _brief_cache.move_to_end(project_id)
        return cached[1]

    spend("brief")
    entities = db.query(Entity).filter_by(project_id=project_id).all()
    clusters = db.query(Cluster).filter_by(project_id=project_id).all()
    opportunities = db.query(Opportunity).filter_by(project_id=project_id).all()
    from ai.brief_generator import generate_brief
    markdown = generate_brief(project, entities, clusters, opportunities)
    slug = project.topic.lower().replace(" ", "-")[:30]
    payload = {"markdown": markdown, "filename": f"brief-{slug}.md"}
    _brief_cache[project_id] = (version, payload)
    _brief_cache.move_to_end(project_id)
    while len(_brief_cache) > _BRIEF_CACHE_MAX:
        _brief_cache.popitem(last=False)
    return payload


@router.post("/{project_id}/ask", dependencies=[Depends(rate_limit("ask"))])
def ask_question(project_id: str, body: AskRequest, db: Session = Depends(get_db)):
    project = _get_or_404(project_id, db)
    if project.status != "ready":
        raise HTTPException(status_code=400, detail="Project is not ready yet")
    question = (body.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")
    spend("ask", project_id)
    entities = db.query(Entity).filter_by(project_id=project_id).all()
    clusters = db.query(Cluster).filter_by(project_id=project_id).all()
    opportunities = (db.query(Opportunity).filter_by(project_id=project_id)
                     .order_by(Opportunity.score.desc(), Opportunity.id).all())
    from ai.qa import answer_question
    return answer_question(project, entities, question, clusters, opportunities)


@router.post("/{project_id}/upload", dependencies=[Depends(rate_limit("upload"))])
async def upload_document(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    x_owner_token: Optional[str] = Header(default=None),
):
    project = _get_or_404(project_id, db)
    forbid_if_protected(project_id, "uploading")
    require_owner(project, x_owner_token)
    if project.status == "building":
        raise HTTPException(status_code=409, detail="Project is already processing")

    filename = file.filename or "upload"
    if not filename.lower().endswith(_ALLOWED_EXT):
        raise HTTPException(status_code=415, detail="Unsupported file type. Use PDF, CSV, TXT or MD.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")

    # Parse here, not in the background: a file with no readable text gets an
    # answer now and leaves the map as it was.
    from sources.uploads import parse_document, csv_rows
    text = await run_in_threadpool(parse_document, filename, content)
    rows = csv_rows(filename, content)
    if not text and not rows:
        hint = (" It may be a scan without a text layer, password-protected or damaged."
                if filename.lower().endswith(".pdf") else "")
        raise HTTPException(status_code=422, detail=f"No readable text in this file.{hint}")
    spend("upload")

    project.status = "building"
    db.commit()
    progress.clear_upload(project_id)
    background_tasks.add_task(_run_ingest, project_id, filename, text, rows)
    return {"status": "building", "filename": filename}


@router.delete("/{project_id}", status_code=204, dependencies=[Depends(rate_limit("delete"))])
def delete_project(project_id: str, db: Session = Depends(get_db),
                   x_owner_token: Optional[str] = Header(default=None)):
    project = _get_or_404(project_id, db)
    forbid_if_protected(project_id, "deleting")
    require_owner(project, x_owner_token)
    # Delete all children before the parent. SQLite does not enforce
    # ondelete="CASCADE" without a per-connection PRAGMA, and on Postgres a
    # bare parent delete raises a FK violation while children still reference it.
    db.query(Opportunity).filter_by(project_id=project_id).delete()
    db.query(Cluster).filter_by(project_id=project_id).delete()
    db.query(Relationship).filter_by(project_id=project_id).delete()
    db.query(Entity).filter_by(project_id=project_id).delete()
    db.delete(project)
    db.commit()


def _run_build(project_id: str):
    db = SessionLocal()
    try:
        build_project_graph(project_id, db)
    except Exception as exc:
        # Log the real exception; show the user a generic, non-leaking message.
        print(f"[build] project={project_id} failed: {exc}")
        project = db.get(ResearchProject, project_id)
        if project:
            project.status = "error"
            project.error_message = "Build failed unexpectedly. Please try again."
            db.commit()
    finally:
        db.close()


def _run_ingest(project_id: str, filename: str, text: str, rows: list[dict]):
    """Extract a sub-graph from an uploaded document's text, merge it into the
    project's graph, and recompute clusters/opportunities.

    A failure goes back to "ready", not "error": the map from before the
    upload is still there, and "error" would hide it behind a rebuild button.
    """
    db = SessionLocal()
    try:
        from ai.extractor import extract_graph
        from graph.builder import enrich_from_extraction

        project = db.get(ResearchProject, project_id)
        if not project:
            return

        entities, relationships = extract_graph(text, project.topic, csv_rows=rows)
        added = enrich_from_extraction(project_id, db, entities, relationships)
        progress.upload_result(project_id, filename, added=added)
    except Exception as exc:
        print(f"[upload] project={project_id} failed: {exc}")
        db.rollback()
        progress.upload_result(project_id, filename, error="The file could not be processed. Try again, or try another file.")
    finally:
        project = db.get(ResearchProject, project_id)
        if project:
            project.status = "ready"
            db.commit()
        db.close()


def _get_or_404(project_id: str, db: Session) -> ResearchProject:
    project = db.query(ResearchProject).filter_by(id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _project_out(p: ResearchProject) -> dict:
    return {
        "id": p.id,
        "topic": p.topic,
        "region": p.region,
        "goal": p.goal,
        "status": p.status,
        "error_message": p.error_message,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        # Real pipeline stage + counts while a build runs (None otherwise).
        "progress": progress.snapshot(p.id) if p.status == "building" else None,
        "last_upload": progress.last_upload(p.id),
        # Portfolio demos: read + ask only (see guard.py).
        "protected": is_protected(p.id),
        # Rebuild/upload/delete need the owner token (see require_owner).
        "locked": p.owner_token_hash is not None,
    }
