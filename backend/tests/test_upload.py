"""Phase 5 — document upload + graph enrichment."""
from database import SessionLocal
from models import Entity


def test_csv_rows_parsing():
    from sources.uploads import csv_rows, parse_document
    content = b"name,note\nFederated learning,a\nDifferential privacy,b\n"
    rows = csv_rows("topics.csv", content)
    assert len(rows) == 2
    assert rows[0]["name"] == "Federated learning"
    text = parse_document("topics.csv", content)
    assert "Federated learning" in text


def test_extract_graph_csv_fallback_without_key():
    from ai.extractor import extract_graph
    rows = [{"name": "Edge inference"}, {"name": "Model distillation"}, {"name": "Edge inference"}]
    entities, relationships = extract_graph("", "AI tutoring", csv_rows=rows)
    names = [e["name"] for e in entities]
    assert "Edge inference" in names and "Model distillation" in names
    assert len(entities) == 2          # de-duplicated
    assert relationships == []


def test_upload_rejects_unsupported_type(client, ready_project):
    r = client.post(
        f"/api/projects/{ready_project}/upload",
        files={"file": ("notes.exe", b"data", "application/octet-stream")},
    )
    assert r.status_code == 415


def test_upload_csv_enriches_and_rebuilds(client, ready_project):
    s = SessionLocal()
    before = s.query(Entity).filter_by(project_id=ready_project).count()
    s.close()

    csv_content = b"concept\nFederated learning\nDifferential privacy\nOn-device inference\n"
    r = client.post(
        f"/api/projects/{ready_project}/upload",
        files={"file": ("topics.csv", csv_content, "text/csv")},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "building"

    # TestClient runs the background ingest before returning — project is ready.
    proj = client.get(f"/api/projects/{ready_project}").json()
    assert proj["status"] == "ready"

    s = SessionLocal()
    after = s.query(Entity).filter_by(project_id=ready_project).count()
    uploaded = s.query(Entity).filter_by(project_id=ready_project, source="upload").count()
    s.close()
    assert after > before
    assert uploaded >= 1


def test_csv_from_excel_exports():
    from sources.uploads import csv_rows, parse_document
    from ai.extractor import _csv_fallback
    names = lambda f, c: [e["name"] for e in _csv_fallback(csv_rows(f, c))]
    # European Excel writes semicolons
    assert names("a.csv", "concept;note\nFederated learning;a\n".encode()) == ["Federated learning"]
    # "Unicode text" export is UTF-16; Windows "CSV" is cp1252
    assert names("a.csv", "concept,note\nCafé data,b\n".encode("utf-16")) == ["Café data"]
    assert names("a.csv", "concept,note\nMüller method,b\n".encode("cp1252")) == ["Müller method"]
    assert "\x00" not in parse_document("a.txt", "Federated learning".encode("utf-16"))
    # an id column first must not turn numbers into nodes
    assert names("a.csv", b"id,concept\n1,Federated learning\n2,Edge AI\n") == ["Federated learning", "Edge AI"]


def test_unreadable_upload_is_refused_and_map_kept(client, ready_project):
    r = client.post(f"/api/projects/{ready_project}/upload",
                    files={"file": ("scan.pdf", b"%PDF-1.4 not really a pdf", "application/pdf")})
    assert r.status_code == 422
    assert "No readable text" in r.json()["detail"]
    assert client.get(f"/api/projects/{ready_project}").json()["status"] == "ready"


def test_failed_ingest_keeps_the_map(client, ready_project, monkeypatch):
    import graph.builder
    def boom(*a, **kw):
        raise RuntimeError("model down")
    monkeypatch.setattr(graph.builder, "enrich_from_extraction", boom)
    r = client.post(f"/api/projects/{ready_project}/upload",
                    files={"file": ("notes.txt", b"Federated learning and edge AI", "text/plain")})
    assert r.status_code == 200
    proj = client.get(f"/api/projects/{ready_project}").json()
    assert proj["status"] == "ready"
    assert proj["last_upload"]["error"] and proj["last_upload"]["filename"] == "notes.txt"


def test_upload_reports_what_it_added(client, ready_project):
    client.post(f"/api/projects/{ready_project}/upload",
                files={"file": ("topics.csv", b"concept\nFederated learning\nDifferential privacy\n", "text/csv")})
    u = client.get(f"/api/projects/{ready_project}").json()["last_upload"]
    assert u["error"] is None and u["added"] >= 1
