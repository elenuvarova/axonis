from sources.wikidata import is_namesake


def test_namesakes_are_filtered():
    for d in ["2017 video game", "family name", "Wikimedia disambiguation page",
              "American economist (1925–2010)", "album by Radiohead", "1999 film directed by X",
              "scientific article published on 24 May 2024", "scholarly article published in 2017", "edition; published in 1993", "book (work)",
              "academic conference", "conference proceedings published in 2017", "academic journal"]:
        assert is_namesake(d), d


def test_concepts_are_kept():
    for d in ["discarded electrical or electronic devices", "economic system aimed at eliminating waste",
              "field of study", "logical fallacy in which the reasoner begins with what they are trying to end with", ""]:
        assert not is_namesake(d), d


def test_top_works_ranks_relevant_pool_by_citations(monkeypatch):
    import sources.openalex as oa
    seen = {}
    def fake_get(path, params):
        seen.update(params)
        return {"results": [{"title": "a", "cited_by_count": 5}, {"title": "b", "cited_by_count": 50}, {"title": "c"}]}
    monkeypatch.setattr(oa, "_get", fake_get)
    works = oa.get_top_works("e-waste", per_page=2)
    assert "sort" not in seen and seen["per-page"] == 40
    assert [w["title"] for w in works] == ["b", "a"]


def test_related_query_is_balanced():
    # A dropped "}}" once made every SPARQL call return 400 and silently
    # removed all Wikidata relations from new maps.
    from sources.wikidata import _RELATED_QUERY
    q = _RELATED_QUERY.format(qid="Q2539")
    assert q.count("{") == q.count("}")
    assert "UNION" in q and "P31" not in q


def test_null_related_concepts_do_not_drop_openalex(monkeypatch):
    import sources.openalex as oa
    monkeypatch.setattr(oa, "search_concepts", lambda q: [{"display_name": "Data science", "related_concepts": None}])
    monkeypatch.setattr(oa, "get_top_works", lambda q, **k: [{"title": "p"}])
    monkeypatch.setattr(oa, "get_top_institutions", lambda q: [])
    out = oa.fetch_entities_for_topic("Data Science")
    assert out["related_concepts"] == [] and len(out["works"]) == 1


def test_descriptive_terms_fall_back_to_full_text_search(monkeypatch):
    # label search finds nothing for "Utility-scale solar farm"; full text
    # does, minus undescribed items and articles
    import sources.wikidata as wd
    monkeypatch.setattr(wd, "search_entities", lambda term, limit: [])
    monkeypatch.setattr(wd, "search_fulltext", lambda term: [
        {"id": "Q1", "label": "A paper", "description": ""},
        {"id": "Q2", "label": "Site selection study", "description": "scholarly article published in 2017"},
        {"id": "Q3", "label": "solar power plant", "description": "large solar power-collecting facility"},
    ])
    monkeypatch.setattr(wd, "get_related", lambda qid: [])
    out = wd.fetch_entities_for_terms(["Utility-scale solar farm"])
    assert [r["label"] for r in out] == ["solar power plant"]


def test_api_key_is_sent_only_when_set(monkeypatch):
    import sources.openalex as oa
    sent = []
    monkeypatch.setattr(oa, "get_json", lambda url, params, **kw: sent.append(params) or {})
    monkeypatch.setattr(oa, "_API_KEY", "")
    oa._get("/works", {"search": "x"})
    monkeypatch.setattr(oa, "_API_KEY", "k123")
    oa._get("/works", {"search": "x"})
    assert "api_key" not in sent[0] and sent[1]["api_key"] == "k123"
