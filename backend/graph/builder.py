"""
End-to-end graph build pipeline.
Called from routers/projects.py as a background task.
"""
from ai import llm
import os
import json
import uuid
import networkx as nx
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from database import SessionLocal
from models import ResearchProject, Entity, Relationship, Cluster, Opportunity
from sources.wikidata import fetch_entities_for_terms
from sources.openalex import fetch_entities_for_topic
from sources.descriptions import fill as describe
from graph.resolver import RawEntity, resolve, MERGE_THRESHOLD
from graph.metrics import compute as compute_metrics
from graph.clustering import label_clusters
from graph.opportunities import score_opportunities
from ai.opportunity_writer import enrich_with_ai
from ai.relevance import keep_relevant
from graph import progress

_MAX_PAPERS = 20


def build_project_graph(project_id: str, db: Session) -> None:
    progress.start(project_id)
    try:
        _build(project_id, db)
    finally:
        progress.finish(project_id)


def _build(project_id: str, db: Session) -> None:
    project = db.query(ResearchProject).filter_by(id=project_id).first()
    if not project:
        return

    topic = project.topic

    # ── Step 1: Expand topic into search terms ─────────────────────────────
    progress.stage(project_id, "expand", f"expanding '{topic}'")
    terms = _expand_topic(topic)
    print(f"[build] project={project_id} topic='{topic}' terms={terms}")
    progress.log(project_id, "expand", f"{len(terms)} search terms: {', '.join(terms[:4])}{'…' if len(terms) > 4 else ''}", terms=len(terms))

    # ── Step 2: Fetch from Wikidata ─────────────────────────────────────────
    raw_entities: list[RawEntity] = []
    progress.stage(project_id, "wikidata", f"querying Wikidata for {min(len(terms), 6)} terms")
    try:
        wd_raw = fetch_entities_for_terms(terms[:6])  # cap to keep API calls sane
        for item in wd_raw:
            parent = item.get("root_label") or item.get("root_term")
            raw_entities.append(RawEntity(
                name=item["label"],
                type="concept",
                description=item.get("description", ""),
                source="wikidata",
                source_url=item.get("source_url", ""),
                wikidata_id=item.get("qid"),
                parent_name=parent if parent != item["label"] else None,
                relation_type=item.get("relation_to_root", "related_to"),
            ))
        print(f"[build] wikidata → {len(raw_entities)} raw entities")
        progress.log(project_id, "wikidata", f"{len(raw_entities)} concepts", wikidata=len(raw_entities))
    except Exception as exc:
        print(f"[build] wikidata error: {exc}")
        progress.log(project_id, "wikidata", "request failed, continuing with OpenAlex")

    # ── Step 3: Fetch from OpenAlex ─────────────────────────────────────────
    progress.stage(project_id, "openalex", "querying OpenAlex works, concepts & institutions")
    try:
        oa = fetch_entities_for_topic(topic, terms)
        # Screen before a paper brings in its topics and institutions: one
        # namesake paper otherwise grows a whole off-topic cluster.
        candidates = len(oa["works"])
        oa["works"] = keep_relevant(topic, oa["works"])[:_MAX_PAPERS]
        print(f"[build] openalex works: {candidates} candidates → {len(oa['works'])} on topic")

        for c in oa["concepts"]:
            raw_entities.append(RawEntity(
                name=c.get("display_name", ""),
                type="concept",
                description=c.get("description", ""),
                source="openalex",
                source_url=c.get("id", ""),
                openalex_id=c.get("id", "").rsplit("/", 1)[-1],
            ))

        for c in oa["related_concepts"]:
            raw_entities.append(RawEntity(
                name=c.get("display_name", ""),
                type="concept",
                source="openalex",
                openalex_id=c.get("id", "").rsplit("/", 1)[-1],
                parent_name=oa["concepts"][0].get("display_name") if oa["concepts"] else None,
                relation_type="related_to",
            ))

        for w in oa["works"]:
            title = w.get("title", "").strip()
            if not title:
                continue
            paper = RawEntity(
                name=title[:200],
                type="paper",
                source="openalex",
                source_url=w.get("doi") or w.get("id", ""),
                openalex_id=w.get("id", "").rsplit("/", 1)[-1],
                confidence=min(1.0, (w.get("cited_by_count", 0) or 0) / 500),
            )
            raw_entities.append(paper)

            # Paper → research topics. OpenAlex "topics" replaced the deprecated
            # concept tagger, whose picks were often namesakes ("Course
            # (navigation)", "Raising (metalworking)") with high scores.
            for t in [t for t in (w.get("topics") or []) if (t.get("score") or 0) >= 0.15][:2]:
                raw_entities.append(RawEntity(
                    name=t.get("display_name", ""),
                    type="concept",
                    source="openalex",
                    parent_name=title[:200],
                    relation_type="co_concept",
                ))
                # topic → its subfield ("Intelligent Tutoring Systems…" → "Artificial
                # Intelligence"): gives the map a real hierarchy to cluster on.
                sub = (t.get("subfield") or {}).get("display_name")
                if sub:
                    raw_entities.append(RawEntity(
                        name=sub, type="concept", source="openalex",
                        parent_name=t.get("display_name", ""), relation_type="part_of",
                    ))

            # Paper → the institutions of its first authors: the actual actors
            # behind the research (institution search by name finds few).
            seen_inst = set()
            for a in (w.get("authorships") or [])[:3]:
                for inst in (a.get("institutions") or [])[:1]:
                    iname = inst.get("display_name", "")
                    if not iname or iname in seen_inst:
                        continue
                    seen_inst.add(iname)
                    raw_entities.append(RawEntity(
                        name=iname, type="institution", source="openalex",
                        openalex_id=(inst.get("id") or "").rsplit("/", 1)[-1],
                        parent_name=title[:200], relation_type="affiliated_with",
                    ))

        for inst in oa["institutions"]:
            raw_entities.append(RawEntity(
                name=inst.get("display_name", ""),
                type="institution",
                source="openalex",
                source_url=inst.get("homepage_url", ""),
                openalex_id=inst.get("id", "").rsplit("/", 1)[-1],
            ))

        print(f"[build] openalex → added, total raw={len(raw_entities)}")
        papers = sum(1 for w in oa["works"] if (w.get("title") or "").strip())
        progress.log(project_id, "openalex",
                     f"{papers} papers · {len(oa['concepts']) + len(oa['related_concepts'])} concepts · {len(oa['institutions'])} institutions",
                     papers=papers, institutions=len(oa["institutions"]))
    except Exception as exc:
        print(f"[build] openalex error: {exc}")
        progress.log(project_id, "openalex", "request failed")

    if not raw_entities:
        project.status = "error"
        project.error_message = "No data returned from Wikidata or OpenAlex"
        db.commit()
        return

    # ── Step 4: Resolve & deduplicate ───────────────────────────────────────
    progress.stage(project_id, "resolve", f"merging {len(raw_entities)} raw records")
    resolved, edges = resolve(raw_entities)
    print(f"[build] resolved → {len(resolved)} entities, {len(edges)} edges")
    progress.log(project_id, "resolve", f"{len(resolved)} unique entities · {len(edges)} edges",
                 entities=len(resolved), edges=len(edges))
    described = describe(resolved)
    print(f"[build] descriptions: {described} filled in")
    progress.stage(project_id, "persist")

    # ── Step 5: Persist entities ────────────────────────────────────────────
    db.query(Relationship).filter_by(project_id=project_id).delete()
    db.query(Entity).filter_by(project_id=project_id).delete()
    db.commit()

    name_to_id: dict[str, str] = {}
    for raw in resolved:
        if not raw.name:
            continue
        eid = str(uuid.uuid4())
        name_to_id[raw.name] = eid
        db.add(Entity(
            id=eid,
            project_id=project_id,
            name=raw.name,
            type=raw.type,
            description=raw.description or None,
            source=raw.source,
            source_url=raw.source_url or None,
            confidence_score=raw.confidence,
            wikidata_id=raw.wikidata_id,
            openalex_id=raw.openalex_id,
        ))
    db.commit()

    # ── Step 6: Persist relationships ───────────────────────────────────────
    for src_name, tgt_name, rel_type in edges:
        src_id = name_to_id.get(src_name)
        tgt_id = name_to_id.get(tgt_name)
        if src_id and tgt_id:
            db.add(Relationship(
                project_id=project_id,
                source_id=src_id,
                target_id=tgt_id,
                relation_type=rel_type,
                weight=1.0,
                evidence_source="wikidata+openalex",
            ))
    db.commit()

    # ── Steps 7–11: metrics, clusters, opportunities ────────────────────────
    _compute_and_persist(project_id, db, topic)

    project.status = "ready"
    db.commit()
    print(f"[build] project={project_id} done — {len(resolved)} nodes, {len(edges)} edges")


def enrich_from_extraction(project_id: str, db: Session, new_entities: list[dict],
                           relationships: list[tuple]) -> int:
    """
    Merge entities/relationships extracted from an uploaded document into the
    project's existing graph, then recompute metrics/clusters/opportunities.
    Returns the number of new entities added.
    """
    project = db.query(ResearchProject).filter_by(id=project_id).first()
    if not project:
        return 0

    existing = db.query(Entity).filter_by(project_id=project_id).all()

    def match_existing(name: str):
        nl = name.lower().strip()
        for e in existing:
            if fuzz.ratio(nl, (e.name or "").lower().strip()) >= MERGE_THRESHOLD:
                return e.id
        return None

    # Insert genuinely-new entities (skip ones that already exist by fuzzy name).
    added_ids: list[str] = []
    name_to_id: dict[str, str] = {}
    for ent in new_entities:
        name = (ent.get("name") or "").strip()
        if not name:
            continue
        existing_id = match_existing(name)
        if existing_id:
            name_to_id[name.lower()] = existing_id
            continue
        if name.lower() in name_to_id:
            continue
        eid = str(uuid.uuid4())
        db.add(Entity(
            id=eid, project_id=project_id, name=name[:500],
            type=ent.get("type", "concept"),
            description=(ent.get("description") or None),
            source="upload", confidence_score=0.8,
        ))
        name_to_id[name.lower()] = eid
        added_ids.append(eid)
    db.commit()

    # Re-read all entities (now including the new ones) for relationship mapping.
    all_entities = db.query(Entity).filter_by(project_id=project_id).all()

    def any_id(name: str):
        nl = name.lower().strip()
        if nl in name_to_id:
            return name_to_id[nl]
        for e in all_entities:
            if fuzz.ratio(nl, (e.name or "").lower().strip()) >= MERGE_THRESHOLD:
                return e.id
        return None

    existing_pairs: set = set()
    for r in db.query(Relationship).filter_by(project_id=project_id).all():
        existing_pairs.add(frozenset([r.source_id, r.target_id]))

    connected: set = set()
    for src, tgt, rel in relationships:
        sid = any_id(src)
        tid = any_id(tgt)
        if sid and tid and sid != tid:
            key = frozenset([sid, tid])
            if key not in existing_pairs:
                existing_pairs.add(key)
                db.add(Relationship(
                    project_id=project_id, source_id=sid, target_id=tid,
                    relation_type=rel or "related_to", weight=1.0,
                    evidence_source="upload",
                ))
            connected.add(sid)
            connected.add(tid)
    db.commit()

    # Anchor any new entity that ended up isolated to the most central existing
    # node, so uploaded knowledge is visibly integrated rather than floating.
    hub = _most_central(existing)
    if hub:
        for eid in added_ids:
            if eid in connected:
                continue
            key = frozenset([hub, eid])
            if eid != hub and key not in existing_pairs:
                existing_pairs.add(key)
                db.add(Relationship(
                    project_id=project_id, source_id=hub, target_id=eid,
                    relation_type="related_to", weight=1.0, evidence_source="upload",
                ))
        db.commit()

    _compute_and_persist(project_id, db, project.topic)
    return len(added_ids)


def _most_central(entities: list):
    if not entities:
        return None
    return max(entities, key=lambda e: (e.degree or 0.0)).id


def _compute_and_persist(project_id: str, db: Session, topic: str) -> None:
    """Recompute graph metrics, clusters and opportunities from the project's
    persisted entities + relationships, and store the results."""
    entities = db.query(Entity).filter_by(project_id=project_id).all()
    if not entities:
        return
    progress.stage(project_id, "metrics", f"centrality & communities over {len(entities)} nodes")
    relationships = db.query(Relationship).filter_by(project_id=project_id).all()

    G = nx.Graph()
    G.add_nodes_from(e.id for e in entities)
    for r in relationships:
        if r.source_id and r.target_id:
            G.add_edge(r.source_id, r.target_id)

    node_metrics = compute_metrics(G)
    by_id = {e.id: e for e in entities}
    for node_id, m in node_metrics.items():
        e = by_id.get(node_id)
        if e:
            e.degree = m.degree
            e.betweenness = m.betweenness
            e.bridge_score = m.bridge_score
            e.cluster_id = m.cluster_id
    db.commit()

    all_entities = db.query(Entity).filter_by(project_id=project_id).all()
    cluster_summaries = label_clusters(all_entities)
    progress.log(project_id, "metrics", f"{len(cluster_summaries)} clusters", clusters=len(cluster_summaries))
    candidates = score_opportunities(cluster_summaries, topic)
    progress.stage(project_id, "insights", f"writing {len(candidates)} opportunity cards")

    entities_by_cluster: dict[str, list] = {}
    for e in all_entities:
        entities_by_cluster.setdefault(e.cluster_id or "0", []).append(e)
    candidates = enrich_with_ai(candidates, topic, entities_by_cluster,
                                on_card=lambda msg: progress.log(project_id, "insights", msg))

    from ai.cluster_labeler import label_clusters_ai
    labels = label_clusters_ai(topic, [(s.cluster_id, s.sample_names or s.top_entity_names, s.size)
                                       for s in cluster_summaries])

    # Swap old clusters and opportunities for new ones in one transaction,
    # after every LLM call: a slow model or a crash mid-way leaves the
    # previous results in place, never an empty map.
    db.query(Opportunity).filter_by(project_id=project_id).delete()
    db.query(Cluster).filter_by(project_id=project_id).delete()

    cluster_id_map: dict[str, str] = {}
    for s in cluster_summaries:
        row = Cluster(
            project_id=project_id, cluster_id=s.cluster_id, name=s.name, label=labels.get(s.cluster_id),
            top_entities=json.dumps(s.top_entity_names), size=s.size,
            research_count=s.research_count, product_count=s.product_count,
            opportunity_score=s.opportunity_score, avg_degree=s.avg_degree,
            max_bridge=s.max_bridge,
        )
        db.add(row)
        db.flush()
        cluster_id_map[s.cluster_id] = row.id

    for cand in candidates:
        db.add(Opportunity(
            project_id=project_id,
            cluster_db_id=cluster_id_map.get(cand.cluster.cluster_id),
            title=cand.title, why_it_matters=cand.why_it_matters,
            risks=json.dumps(cand.risks), next_questions=json.dumps(cand.next_questions),
            evidence_strength=cand.evidence_strength, risk_level=cand.risk_level,
            score=cand.score, generated_by_ai=cand.generated_by_ai,
        ))
    db.commit()
    progress.log(project_id, "insights", f"{len(candidates)} opportunities scored", opportunities=len(candidates))


def _expand_topic(topic: str) -> list[str]:
    """Use Groq (see ai/llm.py) to generate search terms, fall back to simple split."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return _simple_expand(topic)
    try:
        client = llm.client(timeout=20.0)
        response = llm.create(client,
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": (
                    f'Given the research topic "{topic}", return a JSON object with a list of '
                    "8 related search terms for finding relevant entities on Wikidata and OpenAlex. "
                    "Focus on: core concepts, sub-domains, adjacent fields, key actors. "
                    'Return ONLY valid JSON: {"terms": ["term1", "term2", ...]}'
                ),
            }],
        )
        data = json.loads(llm.text(response))
        raw_terms = data.get("terms", []) if isinstance(data, dict) else []
        # The model occasionally returns a bare string or nested objects; keep
        # only non-empty strings so we never slice a string into characters.
        terms = [str(t).strip() for t in raw_terms if isinstance(t, str) and t.strip()]
        if terms:
            return list(dict.fromkeys([topic] + terms))
    except Exception as exc:
        print(f"[expand] groq error: {exc}")
    return _simple_expand(topic)


def _simple_expand(topic: str) -> list[str]:
    parts = topic.split()
    terms = [topic]
    # Only add individual words that are long enough to be meaningful search terms
    # (short tokens like "AI", "UK", "e-" produce noisy Wikidata results)
    if len(parts) > 1:
        terms += [p for p in parts if len(p) > 3]
    return list(dict.fromkeys(terms))[:8]
