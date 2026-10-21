"""Rebuild maps from their sources, for the demo maps the public API won't
rebuild (guard.PROTECTED_PROJECT_IDS).

Usage (inside the app container, with the production env):
    python -m scripts.rebuild_maps <id> ...
Refuses to run without GROQ_API_KEY: a build without the model searches
fewer terms, screens papers more crudely and leaves clusters unnamed, which
is worse than the map it would replace. Exits 1 if any map failed.
"""
from __future__ import annotations

import os
import sys

from database import SessionLocal
from main import ensure_columns
from models import Cluster, Entity, ResearchProject
from routers.projects import _run_build


def main(ids: list[str]) -> int:
    if not ids:
        print("give the ids of the maps to rebuild", file=sys.stderr)
        return 2
    if not os.getenv("GROQ_API_KEY"):
        print("GROQ_API_KEY is not set; not rebuilding", file=sys.stderr)
        return 1
    ensure_columns()
    failed = 0
    for pid in ids:
        db = SessionLocal()
        try:
            project = db.get(ResearchProject, pid)
            if not project or project.status == "building":
                print(f"{pid}: skipped ({'no such map' if not project else 'already building'})")
                failed += 1
                continue
            project.status = "building"
            db.commit()
        finally:
            db.close()
        _run_build(pid)
        db = SessionLocal()
        try:
            project = db.get(ResearchProject, pid)
            nodes = db.query(Entity).filter_by(project_id=pid).count()
            clusters = db.query(Cluster).filter_by(project_id=pid).count()
            print(f"{pid} {project.topic!r}: {project.status}, {nodes} nodes, {clusters} clusters")
            failed += project.status != "ready"
        finally:
            db.close()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
