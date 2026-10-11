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
    h = {"X-Forwarded-For": "203.0.113.7"}  # single hop = what Traefik sends
    codes = [client.post("/api/projects", json={"topic": "t"}, headers=h).status_code for _ in range(3)]
    assert codes == [201, 201, 429]
    # another IP is unaffected
    assert client.post("/api/projects", json={"topic": "t"}, headers={"X-Forwarded-For": "198.51.100.1"}).status_code == 201
    guard.reset()


def test_forged_forwarded_for_does_not_bypass(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMITS_OFF", "0")
    monkeypatch.setitem(guard.LIMITS, "create", (2, 3600))
    guard.reset()
    # Traefik appends the real client last; the forged first hop changes each time.
    codes = [client.post("/api/projects", json={"topic": "t"},
                         headers={"X-Forwarded-For": f"10.0.0.{i}, 203.0.113.9"}).status_code for i in range(3)]
    assert codes == [201, 201, 429]
    guard.reset()


def test_expired_keys_are_swept(monkeypatch):
    import time
    guard.reset()
    guard._hits[("1.2.3.4", "ask")].append(time.time() - 10_000)
    guard._last_sweep = 0
    guard._sweep(time.time())
    assert ("1.2.3.4", "ask") not in guard._hits


def test_overflow_evicts_oldest_not_everyone(monkeypatch):
    import time
    guard.reset()
    monkeypatch.setattr(guard, "_MAX_KEYS", 10)
    now = time.time()
    for i in range(10):
        guard._hits[(f"ip{i}", "ask")].append(now - 100 + i)  # ip9 most recent
    guard._last_sweep = 0
    guard._sweep(now)
    assert ("ip0", "ask") not in guard._hits      # oldest evicted
    assert ("ip9", "ask") in guard._hits          # active client keeps its count
    guard.reset()


def test_trusted_hops_picks_the_right_entry(monkeypatch):
    from types import SimpleNamespace
    req = SimpleNamespace(headers={"x-forwarded-for": "6.6.6.6, 1.1.1.1, 10.0.0.2"}, client=SimpleNamespace(host="10.0.0.9"))
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "1")
    assert guard.client_ip(req) == "10.0.0.2"
    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "2")
    assert guard.client_ip(req) == "1.1.1.1"
    assert guard.client_ip(SimpleNamespace(headers={}, client=SimpleNamespace(host="9.9.9.9"))) == "9.9.9.9"


def test_list_shows_demos_plus_own_only(client, db, monkeypatch):
    demo, mine, other = _proj(db), _proj(db), _proj(db)
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", demo)
    ids = {p["id"] for p in client.get(f"/api/projects?mine={mine}").json()}
    assert ids == {demo, mine}
    assert {p["id"] for p in client.get("/api/projects").json()} == {demo}
    assert client.get(f"/api/projects/{other}").status_code == 200  # still opens by URL
