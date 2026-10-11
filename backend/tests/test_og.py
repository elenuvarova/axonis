import io
import os

import pytest
from PIL import Image

import main
import og


@pytest.fixture(autouse=True)
def _clear_cache():
    og._cache.clear()
    yield
    og._cache.clear()


def test_demo_map_gets_a_1200x630_png(client, ready_project, monkeypatch):
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", ready_project)
    r = client.get(f"/api/og/{ready_project}.png")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.headers["cache-control"] == "public, max-age=86400"
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert Image.open(io.BytesIO(r.content)).size == (1200, 630)


def test_render_is_cached_per_project_and_update(client, db, ready_project, monkeypatch):
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", ready_project)
    calls = []
    real = og.render_card
    monkeypatch.setattr(og, "render_card", lambda data: calls.append(1) or real(data))
    client.get(f"/api/og/{ready_project}.png")
    client.get(f"/api/og/{ready_project}.png")
    assert len(calls) == 1
    from models import ResearchProject
    from datetime import datetime, timedelta
    p = db.get(ResearchProject, ready_project)
    p.updated_at = datetime.utcnow() + timedelta(seconds=5)
    db.commit()
    client.get(f"/api/og/{ready_project}.png")
    assert len(calls) == 2


def test_visitor_map_never_gets_a_custom_image(client, ready_project, monkeypatch):
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", "")
    r = client.get(f"/api/og/{ready_project}.png", follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"] == "/og.jpg"
    assert b"tutoring" not in r.content


def test_unknown_or_malformed_id_falls_back(client, monkeypatch):
    unknown = "00000000-0000-0000-0000-000000000000"
    monkeypatch.setenv("PROTECTED_PROJECT_IDS", unknown)
    for pid in (unknown, "not-a-uuid"):
        r = client.get(f"/api/og/{pid}.png", follow_redirects=False)
        assert r.status_code == 302 and r.headers["location"] == "/og.jpg"


def test_long_unbroken_and_non_latin_topics_still_render():
    png = og.render_card({
        "topic": "Supercalifragilisticexpialidocious" * 3 + " 量子计算 ✓",
        "nodes": [("a", "x" * 80), ("b", "日本語")], "edges": [("a", "b")],
        "node_total": 2, "gap": (96, "t" * 200),
    })
    assert Image.open(io.BytesIO(png)).size == (1200, 630)


def test_shell_points_demo_pages_at_their_card(tmp_path):
    pid = "07796417-cbc2-464e-9185-8b1cf1645ee6"
    src = os.path.join(os.path.dirname(main.__file__), "..", "frontend", "index.html")
    (tmp_path / "index.html").write_text(open(src, encoding="utf-8").read(), encoding="utf-8")
    page = main._shell(str(tmp_path), "AI <tutoring>", pid)
    url = f"https://axonis.app/api/og/{pid}.png"
    assert f'<meta property="og:image" content="{url}"' in page
    assert f'<meta name="twitter:image" content="{url}"' in page
    assert 'content="1200"' in page and 'content="630"' in page
    # A visitor's map (no topic passed) keeps the generic image.
    assert "https://axonis.app/og.jpg" in main._shell(str(tmp_path))
