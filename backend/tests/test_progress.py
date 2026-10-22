from graph import progress
from models import ResearchProject


def test_progress_records_stage_counts_and_log():
    progress.start("p1")
    progress.stage("p1", "wikidata", "querying")
    progress.log("p1", "wikidata", "12 concepts", wikidata=12)
    snap = progress.snapshot("p1")
    assert snap["stage"] == "wikidata"
    assert snap["stage_index"] == 1
    assert snap["counts"] == {"wikidata": 12}
    assert [l["message"] for l in snap["log"]] == ["querying", "12 concepts"]
    assert snap["stages"][0]["key"] == "expand"
    progress.finish("p1")
    assert progress.snapshot("p1") is None


def test_progress_ignores_unknown_runs():
    # _compute_and_persist also runs for uploads, which have no tracked run.
    progress.stage("nope", "metrics", "x")
    progress.log("nope", "metrics", "y", clusters=3)
    assert progress.snapshot("nope") is None


def test_progress_log_keeps_tail():
    progress.start("p2")
    for i in range(60):
        progress.log("p2", "insights", f"line {i}")
    log = progress.snapshot("p2")["log"]
    assert len(log) == 40 and log[-1]["message"] == "line 59"
    progress.finish("p2")


def test_project_endpoint_exposes_progress_only_while_building(client, db):
    p = ResearchProject(topic="t", status="building")
    db.add(p)
    db.commit()
    progress.start(p.id)
    progress.log(p.id, "expand", "3 search terms", terms=3)
    body = client.get(f"/api/projects/{p.id}").json()
    assert body["progress"]["counts"] == {"terms": 3}
    progress.finish(p.id)

    p.status = "ready"
    db.commit()
    assert client.get(f"/api/projects/{p.id}").json()["progress"] is None


def test_openalex_counts_include_institutions_and_topics_from_papers(db, monkeypatch):
    # Institution search by name finds almost nothing; the build screen read
    # "0 institutions" while the map got 18 from paper authorships.
    from graph import builder
    p = ResearchProject(topic="seaweed bioplastics", status="building")
    db.add(p)
    db.commit()
    work = lambda title, insts: {
        "title": title, "id": "W1",
        "topics": [{"display_name": "Algal polymers", "score": 0.9, "subfield": {"display_name": "Polymers"}}],
        "authorships": [{"institutions": [{"display_name": i, "id": "I1"}]} for i in insts],
    }
    monkeypatch.setattr(builder, "_expand_topic", lambda t: [t])
    monkeypatch.setattr(builder, "fetch_entities_for_terms", lambda terms: [])
    monkeypatch.setattr(builder, "fetch_entities_for_topic", lambda t, terms: {
        "concepts": [], "related_concepts": [], "institutions": [],
        "works": [work("Paper A", ["Uni X", "Uni Y"]), work("Paper B", ["Uni X"])],
    })
    monkeypatch.setattr(builder, "keep_relevant", lambda topic, works: works)
    lines = []
    monkeypatch.setattr(builder.progress, "log", lambda pid, src, msg, **c: lines.append((src, msg, c)))

    class Stop(Exception):
        pass

    def stop(raw):
        raise Stop
    monkeypatch.setattr(builder, "resolve", stop)
    try:
        builder._build(p.id, db)
    except Stop:
        pass
    src, msg, counts = next(l for l in lines if l[0] == "openalex")
    assert counts == {"papers": 2, "institutions": 2}
    assert msg == "2 papers · 2 concepts · 2 institutions"
