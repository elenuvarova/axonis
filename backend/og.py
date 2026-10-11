"""Per-map Open Graph image: GET /api/og/<project_id>.png

A 1200x630 card in the B² look (near-black, dot grid, one magenta accent,
Martian Mono) drawn from the map's real top nodes, its topic and its top gap.

Privacy: only protected (public demo) projects get a custom image. Anything
else, including unknown ids, redirects to the static /og.jpg, so a visitor's
topic is never rendered into a publicly fetchable image.
"""
from __future__ import annotations

import math
import os
import random
import re
import threading

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from database import get_db
from guard import is_protected
from models import Entity, Opportunity, Relationship, ResearchProject
from textutil import repair_title

router = APIRouter()

W, H = 1200, 630
BG = (14, 14, 14)
DOT = (36, 36, 36)
LINE = (58, 58, 58)
TEXT = (237, 237, 237)
TEXT2 = (138, 138, 138)
ACCENT = (255, 43, 214)

_FONTS = os.path.join(os.path.dirname(__file__), "assets", "fonts")
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_CACHE_HEADERS = {"Cache-Control": "public, max-age=86400"}

# (project id, updated_at iso) -> PNG bytes. A rebuild bumps updated_at, so a
# stale image is never served; the old key is dropped when a new one is stored.
_cache: dict[tuple[str, str], bytes] = {}
_cache_lock = threading.Lock()
_CACHE_MAX = 64


def _font(weight: str, size: int):
    from PIL import ImageFont
    return ImageFont.truetype(os.path.join(_FONTS, f"MartianMono-Std{weight}.otf"), size)


def _clean(text: str) -> str:
    """Keep to what the bundled font covers (Latin + Cyrillic + basic punctuation)."""
    out = []
    for ch in text:
        o = ord(ch)
        out.append(ch if (o < 0x0530 or 0x2010 <= o <= 0x2026) and ch.isprintable() else "?")
    return " ".join("".join(out).split())


def _truncate(text: str, font, max_w: float) -> str:
    text = _clean(text)
    if font.getlength(text) <= max_w:
        return text
    while text and font.getlength(text + "…") > max_w:
        text = text[:-1]
    return text.rstrip() + "…"


def _wrap(text: str, font, max_w: float, max_lines: int):
    """Greedy word wrap; None if it does not fit in max_lines."""
    lines, cur = [], ""
    for word in _clean(text).split():
        trial = f"{cur} {word}".strip()
        if font.getlength(trial) <= max_w:
            cur = trial
        else:
            if not cur:
                return None  # a single word wider than the column
            lines.append(cur)
            cur = word
    lines.append(cur)
    return lines if len(lines) <= max_lines and all(font.getlength(l) <= max_w for l in lines) else None


def load_card_data(db: Session, project: ResearchProject) -> dict:
    ents = (
        db.query(Entity).filter_by(project_id=project.id)
        .order_by(Entity.degree.desc(), Entity.name).limit(10).all()
    )
    ids = {e.id for e in ents}
    rels = db.query(Relationship).filter_by(project_id=project.id).all() if ids else []
    edges = {(r.source_id, r.target_id) for r in rels if r.source_id in ids and r.target_id in ids and r.source_id != r.target_id}
    nodes_total = db.query(Entity).filter_by(project_id=project.id).count()
    opp = db.query(Opportunity).filter_by(project_id=project.id).order_by(Opportunity.score.desc()).first()
    return {
        "topic": project.topic,
        "nodes": [(e.id, e.name) for e in ents],
        "edges": sorted(edges),
        "node_total": nodes_total,
        "gap": (round(min(1, max(0, opp.score or 0)) * 100), repair_title(opp.title) if opp.title else "") if opp else None,
    }


def render_card(data: dict) -> bytes:
    """Draw the card from plain data (no DB), return PNG bytes."""
    import io
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Dot grid
    for x in range(30, W, 30):
        for y in range(30, H, 30):
            d.rectangle((x, y, x + 1, y + 1), fill=DOT)

    pad, col_w = 64, 500
    label = _font("Rg", 17)
    small = _font("Rg", 14)
    node_font = _font("Rg", 13)

    # Letter sphere behind the graph: Fibonacci points, letters from the node
    # names, nearer ones brighter. Seeded so the same map always draws the same.
    cx, cy, R = 885, 290, 235
    letters = [c for n in data["nodes"] for c in _clean(n[1]).upper() if c.isalnum()] or list("AXONIS")
    rnd = random.Random(len(letters))
    glyph = _font("Rg", 13)
    count = 190
    for i in range(count):
        z = 1 - 2 * (i + 0.5) / count
        r = math.sqrt(max(0, 1 - z * z))
        th = i * math.pi * (3 - math.sqrt(5))
        x, y = r * math.cos(th), z
        depth = (r * math.sin(th) + 1) / 2          # 0 far .. 1 near
        shade = int(30 + 48 * depth)
        d.text((cx + x * R, cy + y * R), letters[rnd.randrange(len(letters))], font=glyph, fill=(shade, shade, shade), anchor="mm")

    # Plotter graph: the top nodes on a ring, joined by their real relationships.
    nodes = data["nodes"]
    pos = {}
    n = len(nodes)
    ring = 150
    for i, (nid, _) in enumerate(nodes):
        a = -math.pi / 2 + 2 * math.pi * i / max(1, n)
        pos[nid] = (cx + ring * math.cos(a), cy + ring * math.sin(a), a)
    for s, t in data["edges"]:
        d.line((pos[s][0], pos[s][1], pos[t][0], pos[t][1]), fill=LINE, width=1)
    for i, (nid, name) in enumerate(nodes):
        x, y, a = pos[nid]
        hot = i == 0
        k = 7 if hot else 5
        d.rectangle((x - k, y - k, x + k, y + k), fill=ACCENT if hot else TEXT)
        side = math.cos(a)
        # Labels sit outside the ring, away from the centre.
        ax = "lm" if side > 0.25 else ("rm" if side < -0.25 else "mm")
        off = 16 if ax != "mm" else 0
        ly = y + (-20 if math.sin(a) < 0 and ax == "mm" else (20 if ax == "mm" else 0))
        lx = x + (off if ax == "lm" else (-off if ax == "rm" else 0))
        # Room for the label: to the card edge on the right, to the title column on the left.
        room = {"lm": W - 36 - lx, "rm": lx - (pad + col_w + 12), "mm": 2 * min(lx - (pad + col_w), W - 36 - lx)}[ax]
        txt = _truncate(name, node_font, max(60, min(190, room)))
        d.text((lx, ly), txt, font=node_font, fill=TEXT if hot else TEXT2, anchor=ax)

    # Left column
    d.text((pad, 64), "AXONIS", font=_font("Md", 20), fill=TEXT, anchor="lm")
    d.text((pad + 118, 64), "KNOWLEDGE MAP", font=label, fill=TEXT2, anchor="lm")
    d.line((pad, 92, pad + 56, 92), fill=ACCENT, width=3)

    title = None
    for size in (68, 60, 52, 46, 40):
        f = _font("Md", size)
        lines = _wrap(data["topic"], f, col_w, 4 if size <= 52 else 3)
        if lines:
            title = (f, lines, size)
            break
    if not title:
        f = _font("Md", 40)
        title = (f, [_truncate(data["topic"], f, col_w)], 40)
    f, lines, size = title
    y = 150
    for line in lines:
        d.text((pad, y), line, font=f, fill=TEXT, anchor="la")
        y += int(size * 1.2)

    d.text((pad, y + 14), f"{data['node_total']} NODES", font=label, fill=TEXT2, anchor="la")

    # Footer: the top gap in magenta, then the domain.
    if data["gap"]:
        score, gtitle = data["gap"]
        gf = _font("Rg", 19)
        d.text((pad, H - 118), "GAP 01 · %d" % score, font=_font("Md", 19), fill=ACCENT, anchor="ls")
        if gtitle:
            d.text((pad, H - 88), _truncate(gtitle, gf, col_w), font=gf, fill=ACCENT, anchor="ls")
    d.line((pad, H - 64, W - pad, H - 64), fill=LINE, width=1)
    d.text((pad, H - 36), "axonis.app", font=small, fill=TEXT, anchor="lm")
    d.text((W - pad, H - 36), "MAP ANY DOMAIN", font=small, fill=TEXT2, anchor="rm")

    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


@router.get("/og/{project_id}.png", include_in_schema=False)
def og_image(project_id: str, db: Session = Depends(get_db)):
    fallback = RedirectResponse("/og.jpg", status_code=302, headers=_CACHE_HEADERS)
    if not _UUID.match(project_id) or not is_protected(project_id):
        return fallback
    project = db.get(ResearchProject, project_id)
    if not project or project.status != "ready":
        return fallback
    key = (project_id, project.updated_at.isoformat() if project.updated_at else "")
    with _cache_lock:
        png = _cache.get(key)
    if png is None:
        png = render_card(load_card_data(db, project))
        with _cache_lock:
            for old in [k for k in _cache if k[0] == project_id]:
                del _cache[old]
            if len(_cache) >= _CACHE_MAX:
                _cache.pop(next(iter(_cache)))
            _cache[key] = png
    return Response(png, media_type="image/png", headers=_CACHE_HEADERS)
