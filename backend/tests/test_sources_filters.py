from sources.wikidata import is_namesake


def test_namesakes_are_filtered():
    for d in ["2017 video game", "family name", "Wikimedia disambiguation page",
              "American economist (1925–2010)", "album by Radiohead", "1999 film directed by X",
              "scientific article published on 24 May 2024", "edition; published in 1993", "book (work)",
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
    monkeypatch.setattr(oa, "get_top_works", lambda q: [{"title": "p"}])
    monkeypatch.setattr(oa, "get_top_institutions", lambda q: [])
    out = oa.fetch_entities_for_topic("Data Science")
    assert out["related_concepts"] == [] and len(out["works"]) == 1
