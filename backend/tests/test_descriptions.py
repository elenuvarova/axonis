"""Node descriptions filled in from OpenAlex and Wikidata (offline fakes)."""
from graph.resolver import RawEntity
import sources.descriptions as d


def _fake_openalex(calls):
    def fake_get(path, params):
        calls.append((path, params["filter"]))
        if path == "/works":
            return {"results": [
                {"id": "https://openalex.org/W1",
                 "abstract_inverted_index": {"Background:": [0], "E-waste": [1], "is": [2], "growing": [3],
                                             "fast": [4], "around": [5], "the": [6], "world.": [7], "We": [8], "map": [9], "it.": [10]},
                 "topics": [{"id": "https://openalex.org/T9", "display_name": "Waste Recycling",
                             "subfield": {"id": "https://openalex.org/subfields/2311", "display_name": "Waste Management"}}]},
                {"id": "https://openalex.org/W2", "abstract_inverted_index": None,
                 "publication_year": 2020, "cited_by_count": 1234, "topics": []},
            ]}
        if path == "/topics":
            return {"results": [{"id": "https://openalex.org/T9",
                                 "description": "This cluster of papers focuses on recycling. It also covers more."}]}
        if path == "/subfields":
            return {"results": [{"id": "https://openalex.org/subfields/2311", "description": "managing waste"}]}
        if path == "/institutions":
            return {"results": [
                {"id": "https://openalex.org/I1", "type": "education", "ids": {"wikidata": "http://www.wikidata.org/entity/Q5"},
                 "geo": {"city": "Leuven", "country": "Belgium"}},
                {"id": "https://openalex.org/I2", "type": "company", "ids": {}, "geo": {"city": "Ghent", "country": "Belgium"}},
            ]}
        return {"results": []}
    return fake_get


def _fake_wikidata(url, params=None, **kw):
    descs = {"Q5": "public university in Leuven", "Q7": "reuse of discarded electronics"}
    return {"entities": {q: {"descriptions": {"en": {"value": descs[q]}}} if q in descs else {}
                         for q in params["ids"].split("|")}}


def test_fill_from_both_sources(monkeypatch):
    calls = []
    monkeypatch.setattr(d, "_get", _fake_openalex(calls))
    monkeypatch.setattr(d, "get_json", _fake_wikidata)
    ents = [
        RawEntity(name="E-waste paper", type="paper", source="openalex", openalex_id="W1"),
        RawEntity(name="Paywalled paper", type="paper", source="openalex", openalex_id="W2"),
        RawEntity(name="Waste Recycling", type="concept", source="openalex"),   # topic, no ID
        RawEntity(name="Waste Management", type="concept", source="openalex"),  # subfield, no ID
        RawEntity(name="KU Leuven", type="institution", source="openalex", openalex_id="I1"),
        RawEntity(name="Umicore", type="institution", source="openalex", openalex_id="I2"),
        RawEntity(name="e-waste recycling", type="concept", source="wikidata", wikidata_id="Q7"),
        RawEntity(name="Kept", type="concept", source="wikidata", wikidata_id="Q8", description="already here"),
    ]
    assert d.fill(ents) == 7
    got = {e.name: e.description for e in ents}
    assert got["E-waste paper"] == "E-waste is growing fast around the world."
    assert got["Paywalled paper"] == "Paper from 2020, cited 1,234 times"
    assert got["Waste Recycling"] == "Papers on recycling."
    assert got["Waste Management"] == "managing waste"
    assert got["KU Leuven"] == "public university in Leuven"   # Wikidata beats the composed line
    assert got["Umicore"] == "Company in Ghent, Belgium"
    assert got["e-waste recycling"] == "reuse of discarded electronics"
    assert got["Kept"] == "already here"
    # topic IDs found by name are kept, so the map remembers them
    assert ents[2].openalex_id == "T9" and ents[3].openalex_id == "subfields/2311"
    assert ents[4].wikidata_id == "Q5"
    # one batched call per kind, not one per node
    assert [p for p, _ in calls] == ["/works", "/topics", "/subfields", "/institutions"]


def test_failures_leave_nodes_alone(monkeypatch):
    def boom(*a, **kw):
        raise RuntimeError("down")
    monkeypatch.setattr(d, "_get", boom)
    monkeypatch.setattr(d, "get_json", boom)
    ents = [RawEntity(name="x", type="paper", source="openalex", openalex_id="W1"),
            RawEntity(name="y", type="concept", source="wikidata", wikidata_id="Q1")]
    assert d.fill(ents) == 0
    assert all(e.description == "" for e in ents)


def test_nothing_missing_makes_no_calls(monkeypatch):
    monkeypatch.setattr(d, "_get", lambda *a: (_ for _ in ()).throw(AssertionError("called")))
    assert d.fill([RawEntity(name="x", type="concept", description="has one")]) == 0


def test_batches_of_fifty(monkeypatch):
    filters = []
    monkeypatch.setattr(d, "_get", lambda path, params: filters.append(params["filter"]) or {"results": []})
    d._lookup("/works", [f"W{i}" for i in range(120)], "id")
    assert [f.count("|") + 1 for f in filters] == [50, 50, 20]


def test_first_sentence():
    assert d._first_sentence("Introduction. E-waste is growing fast across the whole wide world. More.") \
        == "Introduction. E-waste is growing fast across the whole wide world."
    assert d._first_sentence("<p>Abstract: Short</p>") == "Short"
    long = "word " * 100
    out = d._first_sentence(long)
    assert len(out) <= d._MAX_LEN + 1 and out.endswith("…")
    assert d._first_sentence(None) == ""
