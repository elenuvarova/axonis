"""
Label Louvain clusters and compute per-cluster signals used for opportunity scoring.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class ClusterSummary:
    cluster_id: str
    entity_ids: list[str] = field(default_factory=list)
    top_entity_names: list[str] = field(default_factory=list)
    # up to eight members with their type, for the cluster labeller
    sample_names: list[str] = field(default_factory=list)
    name: str = ""
    size: int = 0
    research_count: int = 0   # papers + institutions
    product_count: int = 0
    concept_count: int = 0
    avg_degree: float = 0.0
    max_bridge: float = 0.0
    opportunity_score: float = 0.0


def label_clusters(entities: list) -> list[ClusterSummary]:
    """
    Group entities by cluster_id, compute signals, derive a readable name.
    `entities` are SQLAlchemy Entity rows with: id, name, type, degree,
    betweenness, bridge_score, cluster_id.
    """
    groups: dict[str, list] = defaultdict(list)
    for e in entities:
        cid = e.cluster_id or "0"
        groups[cid].append(e)

    summaries: list[ClusterSummary] = []

    for cid, members in groups.items():
        if len(members) < 2:
            # Singleton clusters carry no signal — skip
            continue

        research = sum(1 for e in members if e.type in ("paper", "institution"))
        products = sum(1 for e in members if e.type == "product")
        concepts = sum(1 for e in members if e.type == "concept")

        degrees = [e.degree or 0.0 for e in members]
        avg_deg = sum(degrees) / len(degrees) if degrees else 0.0
        max_bridge = max((e.bridge_score or 0.0) for e in members)

        # Name the cluster: top-3 entities by degree, concepts first and paper
        # titles last (a sentence-long paper title makes a poor cluster name).
        rank = {"concept": 2, "paper": 0}
        sorted_members = sorted(
            members,
            key=lambda e: (rank.get(e.type, 1), e.degree or 0.0),
            reverse=True,
        )
        top_names = [e.name for e in sorted_members[:3]]
        name = _generate_name(top_names, research, products)

        s = ClusterSummary(
            cluster_id=cid,
            entity_ids=[e.id for e in members],
            top_entity_names=top_names,
            sample_names=label_sample(members),
            name=name,
            size=len(members),
            research_count=research,
            product_count=products,
            concept_count=concepts,
            avg_degree=round(avg_deg, 4),
            max_bridge=round(max_bridge, 4),
        )
        summaries.append(s)

    # Sort by size descending so the most populated clusters come first
    summaries.sort(key=lambda s: s.size, reverse=True)
    return summaries


def label_sample(members: list, n: int = 8) -> list[str]:
    """The members the cluster labeller sees, as "name (type)". Anything with
    name, type and degree will do (evals/run.py passes plain records).
    Institutions go last: they say who works on a subject, not what it is,
    and a sample of university names got named after the universities."""
    rank = {"concept": 3, "product": 2, "paper": 1}
    ordered = sorted(members, key=lambda e: (rank.get(e.type, 1), e.degree or 0.0), reverse=True)
    return [f"{e.name[:60]} ({e.type})" for e in ordered[:n]]


def _generate_name(top_names: list[str], research_count: int, product_count: int) -> str:
    """
    Build a cluster name from the top entity names.
    Strips redundant words and capitalises properly.
    """
    if not top_names:
        return "Unnamed cluster"
    # First 2 names, each cut on a word boundary, joined with ' · '
    from textutil import short
    parts = [short(n, 32) for n in top_names[:2]]
    base = " · ".join(parts)
    return base.strip()
