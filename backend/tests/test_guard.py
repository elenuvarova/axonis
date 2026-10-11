import guard
from models import ResearchProject


def _proj(db, status="ready"):
    p = ResearchProject(topic="demo", status=status); db.add(p); db.commit(); return p.id


def test_protected_project_rejects_delete_build_upload(client, db, monkeypatch):
    pid = _proj(db)
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", f"x,{pid}")
    assert client.get(f"/api/projects/{pid}").json()["protected"] is True
    assert client.delete(f"/api/projects/{pid}").status_code == 403
    assert client.post(f"/api/projects/{pid}/build").status_code == 403
    r = client.post(f"/api/projects/{pid}/upload", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 403
    assert client.get(f"/api/projects/{pid}").status_code == 200


def test_unprotected_project_can_still_be_deleted(client, db, monkeypatch):
    pid = _proj(db)
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", "")
    assert client.get(f"/api/projects/{pid}").json()["protected"] is False
    assert client.delete(f"/api/projects/{pid}").status_code == 204


def test_rate_limit_returns_429_per_ip(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMITS_OFF", "0")
    monkeypatch.setitem(guard.LIMITS, "create", (2, 3600))
    guard.reset()
    h = {"X-Forwarded-For": "203.0.113.7"}
    codes = [client.post("/api/projects", json={"topic": "t"}, headers=h).status_code for _ in range(3)]
    assert codes == [201, 201, 429]
    # another IP is unaffected
    assert client.post("/api/projects", json={"topic": "t"}, headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 201
    guard.reset()
