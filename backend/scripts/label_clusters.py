"""Backfill short cluster labels on maps built before cluster labels existed.

Usage (inside the app container, with the production env):
    python -m scripts.label_clusters            # every project
    python -m scripts.label_clusters <id> ...   # just these
Only fills clusters whose label is empty; existing labels are kept.
"""
from __future__ import annotations

import json
import sys

from database import SessionLocal
from main import ensure_columns
from models import Cluster, ResearchProject
from ai.cluster_labeler import label_clusters_ai


def run(ids: list[str]) -> None:
    ensure_columns()
    db = SessionLocal()
    try:
        q = db.query(ResearchProject).filter_by(status="ready")
        if ids:
            q = q.filter(ResearchProject.id.in_(ids))
        for p in q.all():
            rows = db.query(Cluster).filter_by(project_id=p.id).all()
            todo = [c for c in rows if not c.label]
            if not todo:
                continue
            labels = label_clusters_ai(p.topic, [(c.cluster_id, json.loads(c.top_entities or "[]")) for c in todo])
            for c in todo:
                c.label = labels.get(c.cluster_id)
            db.commit()
            print(f"{p.id} {p.topic!r}: " + "; ".join(f"{c.cluster_id}={c.label}" for c in todo))
    finally:
        db.close()


if __name__ == "__main__":
    run(sys.argv[1:])
