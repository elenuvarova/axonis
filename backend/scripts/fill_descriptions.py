"""Fill in missing node descriptions on maps that already exist.

New builds do this themselves (sources/descriptions.py); this backfills maps
built before that. Only OpenAlex and Wikidata are called, no model, and only
empty descriptions are written.

Usage (inside the app container, with the production env):
    python -m scripts.fill_descriptions            # every ready map
    python -m scripts.fill_descriptions <id> ...
"""
from __future__ import annotations

import sys

from database import SessionLocal
from main import ensure_columns
from models import Entity, ResearchProject
from sources.descriptions import fill


def main(ids: list[str]) -> int:
    ensure_columns()
    db = SessionLocal()
    try:
        q = db.query(ResearchProject).filter_by(status="ready")
        projects = q.filter(ResearchProject.id.in_(ids)).all() if ids else q.all()
        for p in projects:
            entities = db.query(Entity).filter_by(project_id=p.id).all()
            added = fill(entities)
            db.commit()
            have = sum(1 for e in entities if e.description)
            print(f"{p.id} {p.topic!r}: +{added}, {have}/{len(entities)} described")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
