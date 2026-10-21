"""The first-party Umami path: tracker served from this origin, events
forwarded with the visitor's address and user agent."""
import httpx

from routers import stats


class FakeResponse:
    def __init__(self, status=200, content=b"", ctype="application/json"):
        self.status_code, self.content, self.headers = status, content, {"content-type": ctype}


class FakeClient:
    calls = []

    def __init__(self, *a, **k): pass
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False

    async def get(self, url):
        FakeClient.calls.append(("GET", url, None))
        return FakeResponse(200, b"console.log('umami')", "application/javascript")

    async def post(self, url, content=None, headers=None):
        FakeClient.calls.append(("POST", url, headers))
        return FakeResponse(200, b'{"ok":true}')


def test_tracker_is_served_first_party(client, monkeypatch):
    monkeypatch.setattr(stats.httpx, "AsyncClient", FakeClient)
    stats._script.update(body=b"", at=0.0)
    r = client.get("/s/a.js")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/javascript")
    assert b"umami" in r.content


def test_events_are_forwarded_with_client_details(client, monkeypatch):
    monkeypatch.setattr(stats.httpx, "AsyncClient", FakeClient)
    FakeClient.calls.clear()
    r = client.post("/s/api/send", content=b'{"type":"event"}',
                    headers={"user-agent": "Mozilla/5.0 test", "x-forwarded-for": "203.0.113.9"})
    assert r.status_code == 200
    method, url, headers = FakeClient.calls[-1]
    assert method == "POST" and url.endswith("/api/send")
    assert headers["User-Agent"] == "Mozilla/5.0 test"
    assert headers["X-Forwarded-For"] == "203.0.113.9"
    # Traefik in front of Umami rewrites X-Real-IP/X-Forwarded-For
    assert headers["True-Client-IP"] == "203.0.113.9"


def test_analytics_outage_never_breaks_the_page(client, monkeypatch):
    class Down(FakeClient):
        async def post(self, *a, **k):
            raise httpx.ConnectError("down")
    monkeypatch.setattr(stats.httpx, "AsyncClient", Down)
    assert client.post("/s/api/send", content=b"{}").status_code == 204


def test_headless_crawlers_are_dropped(client, monkeypatch):
    monkeypatch.setattr(stats.httpx, "AsyncClient", FakeClient)
    FakeClient.calls.clear()
    iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"
    for ua, screen in [("Mozilla/5.0 (X11; Linux x86_64)", "800x600"), (iphone, "1920x1080")]:
        body = ('{"type":"event","payload":{"screen":"%s"}}' % screen).encode()
        assert client.post("/s/api/send", content=body, headers={"user-agent": ua}).status_code == 204
    assert FakeClient.calls == []
    for ua, screen in [(iphone, "390x844"), ("Mozilla/5.0 (Macintosh)", "1512x982")]:
        body = ('{"type":"event","payload":{"screen":"%s"}}' % screen).encode()
        assert client.post("/s/api/send", content=body, headers={"user-agent": ua}).status_code == 200
    assert len(FakeClient.calls) == 2
