"""Backfill short cluster labels on maps built before cluster labels existed,
or whose labelling failed (those keep a NULL label).

Usage (inside the app container, with the production env):
    python -m scripts.label_clusters            # every project
    python -m scripts.label_clusters <id> ...   # just these
    python -m scripts.label_clusters --force <id> ...  # relabel even if set
Without --force only empty labels are filled. Either way a label is only
replaced by one the model gave; clusters it didn't name keep what they had.
Exits 1 when the model named nothing at all (no key, an outage).
"""
from __future__ import annotations

import json
import sys

from database import SessionLocal
from main import ensure_columns
from models import Cluster, ResearchProject
from ai.cluster_labeler import label_clusters_ai


def run(ids: list[str], force: bool = False) -> tuple[int, int]:
    """Returns (clusters sent to the model, clusters that got a new label)."""
    ensure_columns()
    db = SessionLocal()
    asked = named = 0
    try:
        q = db.query(ResearchProject).filter_by(status="ready")
        if ids:
            q = q.filter(ResearchProject.id.in_(ids))
        for pid, topic in [(p.id, p.topic) for p in q.all()]:
            try:
                rows = db.query(Cluster).filter_by(project_id=pid).all()
                todo = rows if force else [c for c in rows if not c.label]
                if not todo:
                    continue
                asked += len(todo)
                pairs = [(c.cluster_id, json.loads(c.top_entities or "[]")) for c in todo]
                db.rollback()  # don't hold a transaction open while the model thinks
                labels = label_clusters_ai(topic, pairs)
                # a rebuild may have replaced this map's clusters meanwhile
                project = db.get(ResearchProject, pid)
                if not labels or not project or project.status != "ready":
                    print(f"{pid} {topic!r}: skipped ({'no labels' if not labels else 'map changed'})")
                    continue
                rows = db.query(Cluster).filter(Cluster.project_id == pid,
                                                Cluster.cluster_id.in_(list(labels))).all()
                for c in rows:
                    c.label = labels[c.cluster_id]
                db.commit()
                named += len(rows)
                print(f"{pid} {topic!r}: " + "; ".join(f"{c.cluster_id}={c.label}" for c in rows))
            except Exception as exc:
                db.rollback()
                print(f"{pid} {topic!r}: failed: {exc}")
    finally:
        db.close()
    return asked, named


def main(args: list[str]) -> int:
    flags = [a for a in args if a.startswith("-")]
    unknown = [f for f in flags if f != "--force"]
    if unknown:
        print(f"unknown option {unknown[0]}; the only option is --force", file=sys.stderr)
        return 2
    asked, named = run([a for a in args if not a.startswith("-")], force="--force" in flags)
    if asked and not named:
        print("no cluster was labelled (is GROQ_API_KEY set?)", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
