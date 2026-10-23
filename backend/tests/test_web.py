"""Serving the SPA: real 404s, cache headers, demo-map meta for link
previews, and the permanent redirect from the old host."""
import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import main
import models

SHELL = """<!doctype html><html><head>
<title>Axonis — home</title>
<link rel="canonical" href="https://axonis.app/" />
<meta property="og:url" content="https://axonis.app/" />
<meta
  name="description"
  content="home description"
/>
<meta property="og:title" content="Axonis — home" />
<meta property="og:description" content="home og" />
<meta name="twitter:title" content="Axonis — home" />
<meta name="twitter:description" content="home tw" />
</head><body><div id="root"></div></body></html>"""


@pytest.fixture
def web(tmp_path):
    (tmp_path / "index.html").write_text(SHELL, encoding="utf-8")
    (tmp_path / "robots.txt").write_text("User-agent: *", encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)", encoding="utf-8")
    app = FastAPI()
    main.mount_frontend(app, str(tmp_path))
    return TestClient(app)


def _project(db, topic):
    p = models.ResearchProject(topic=topic, status="ready")
    db.add(p)
    db.commit()
    return p.id


def test_home_shell_is_not_cached(web):
    r = web.get("/")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-cache"
    assert "<title>Axonis — home</title>" in r.text


def test_hashed_assets_are_immutable(web):
    r = web.get("/assets/index-abc123.js")
    assert r.status_code == 200
    assert "immutable" in r.headers["cache-control"]


def test_root_files_get_a_day(web):
    r = web.get("/robots.txt")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=86400"


def test_unknown_page_is_a_real_404(web):
    r = web.get("/nope/xyz")
    assert r.status_code == 404
    assert 'id="root"' in r.text  # the SPA still renders its own not-found page


def test_unknown_api_path_is_json_404(web):
    r = web.get("/api/nonexistent")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")


def test_missing_project_page_is_404(web):
    assert web.get("/project/00000000-0000-0000-0000-000000000000").status_code == 404


def test_demo_map_page_carries_its_topic(web, db, monkeypatch):
    pid = _project(db, "Solar <land> scouting")
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", pid)
    r = web.get(f"/project/{pid}")
    assert r.status_code == 200
    assert "<title>Solar &lt;land&gt; scouting — knowledge map · Axonis</title>" in r.text
    assert f'href="https://axonis.app/project/{pid}"' in r.text
    assert f'og:url" content="https://axonis.app/project/{pid}"' in r.text
    assert "home description" not in r.text and "home og" not in r.text and "home tw" not in r.text
    assert 'twitter:title" content="Solar &lt;land&gt; scouting' in r.text


def test_own_map_page_keeps_generic_head(web, db, monkeypatch):
    pid = _project(db, "my secret topic")
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", "")
    r = web.get(f"/project/{pid}")
    assert r.status_code == 200
    assert "secret" not in r.text
    assert "<title>Axonis — home</title>" in r.text


def test_health_answers_head(client):
    assert client.head("/api/health").status_code == 200


def test_own_map_page_is_not_indexed(web, db, monkeypatch):
    pid = _project(db, "my secret topic")
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", "")
    r = web.get(f"/project/{pid}")
    assert r.headers["x-robots-tag"] == "noindex"
    assert '<meta name="robots" content="noindex" />' in r.text


def test_demo_map_page_is_indexable(web, db, monkeypatch):
    pid = _project(db, "AI tutoring")
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", pid)
    r = web.get(f"/project/{pid}")
    assert "x-robots-tag" not in r.headers
    assert "noindex" not in r.text


def test_home_is_indexable_and_404_is_not(web):
    home = web.get("/")
    assert "x-robots-tag" not in home.headers and "noindex" not in home.text
    assert web.get("/nope").headers["x-robots-tag"] == "noindex"


def test_sitemap_lists_home_and_ready_demos_only(web, db, monkeypatch):
    demo = _project(db, "AI tutoring")
    own = _project(db, "my secret topic")
    broken = models.ResearchProject(topic="half built", status="building")
    db.add(broken)
    db.commit()
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", f"{demo},{broken.id},00000000-0000-0000-0000-000000000000")
    r = web.get("/sitemap.xml")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/xml")
    assert "<loc>https://axonis.app/</loc>" in r.text
    assert f"<loc>https://axonis.app/project/{demo}</loc><lastmod>" in r.text
    assert own not in r.text and broken.id not in r.text and "00000000" not in r.text
