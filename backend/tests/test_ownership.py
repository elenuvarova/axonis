"""Owner tokens, input limits and the request-size cap."""
import models


def _create(client, topic="e-waste"):
    r = client.post("/api/projects", json={"topic": topic})
    assert r.status_code == 201
    return r.json()


def test_create_returns_owner_token_once(client):
    body = _create(client)
    assert body["owner_token"] and body["locked"] is True
    got = client.get(f"/api/projects/{body['id']}").json()
    assert "owner_token" not in got
    assert all("owner_token" not in p for p in client.get("/api/projects").json())


def test_delete_needs_the_owner_token(client):
    body = _create(client)
    pid, token = body["id"], body["owner_token"]
    assert client.delete(f"/api/projects/{pid}").status_code == 403
    assert client.delete(f"/api/projects/{pid}", headers={"X-Owner-Token": "wrong"}).status_code == 403
    assert client.delete(f"/api/projects/{pid}", headers={"X-Owner-Token": token}).status_code == 204


def test_build_and_upload_need_the_owner_token(client):
    pid = _create(client)["id"]
    assert client.post(f"/api/projects/{pid}/build").status_code == 403
    r = client.post(f"/api/projects/{pid}/upload", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 403


def test_legacy_maps_without_token_are_read_only(client, db):
    p = models.ResearchProject(topic="old map", status="ready")
    db.add(p)
    db.commit()
    assert client.get(f"/api/projects/{p.id}").json()["locked"] is False
    assert client.delete(f"/api/projects/{p.id}").status_code == 403
    assert client.delete(f"/api/projects/{p.id}", headers={"X-Owner-Token": "anything"}).status_code == 403
    assert client.post(f"/api/projects/{p.id}/build").status_code == 403
    r = client.post(f"/api/projects/{p.id}/upload", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 403
    assert client.get(f"/api/projects/{p.id}").status_code == 200


def test_topic_and_question_lengths_are_capped(client, ready_project):
    assert client.post("/api/projects", json={"topic": "x" * 201}).status_code == 422
    assert client.post("/api/projects", json={"topic": ""}).status_code == 422
    r = client.post(f"/api/projects/{ready_project}/ask", json={"question": "q" * 1001})
    assert r.status_code == 422


def test_oversized_body_is_rejected_before_reading(client):
    r = client.post("/api/projects/x/upload", content=b"x", headers={"content-length": str(50 * 1024 * 1024),
                                                                     "content-type": "text/plain"})
    assert r.status_code == 413
