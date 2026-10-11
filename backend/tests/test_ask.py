"""Phase 6 — RAG Q&A over the graph."""


def test_ask_requires_ready_project(client):
    pid = client.post("/api/projects", json={"topic": "x"}).json()["id"]
    r = client.post(f"/api/projects/{pid}/ask", json={"question": "what is x?"})
    assert r.status_code == 400


def test_ask_rejects_empty_question(client, ready_project):
    r = client.post(f"/api/projects/{ready_project}/ask", json={"question": "   "})
    assert r.status_code == 400


def test_ask_returns_answer_and_highlighted_nodes(client, ready_project):
    r = client.post(
        f"/api/projects/{ready_project}/ask",
        json={"question": "adaptive learning systems"},
    )
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["answer"], str) and body["answer"]
    assert isinstance(body["highlighted_nodes"], list) and len(body["highlighted_nodes"]) >= 1
    assert all(isinstance(s["id"], str) and s["name"] for s in body["sources"])


def test_retrieve_ranks_by_relevance(db, ready_project):
    from models import Entity
    from ai.qa import retrieve
    entities = db.query(Entity).filter_by(project_id=ready_project).all()
    top = retrieve(entities, "adaptive learning")
    assert top  # non-empty
    assert top[0].name == "Adaptive learning"


def test_sources_are_numbered_and_answer_cites_them(client, ready_project):
    body = client.post(
        f"/api/projects/{ready_project}/ask", json={"question": "adaptive learning systems"},
    ).json()
    assert [s["n"] for s in body["sources"]] == list(range(1, len(body["sources"]) + 1))
    assert "[1]" in body["answer"]  # template answer cites its nodes too


def test_clean_citations_drops_out_of_range_markers():
    from ai.qa import clean_citations
    assert clean_citations("Gaps in tutoring [1][7]. Strong research [2] .", 3) == "Gaps in tutoring [1]. Strong research [2]."
