"""The prompt evals (evals/run.py) call the real model, so CI can't run them.
These keep the cases well-formed and the checks honest, offline."""
import json
from pathlib import Path

from evals import run

EVALS = Path(run.__file__).parent


def _cases(name):
    return json.loads((EVALS / name).read_text())["cases"]


def test_relevance_cases_are_well_formed():
    for case in _cases("relevance.json"):
        assert case["topic"] and case["papers"]
        labels = [p[0] for p in case["papers"]]
        assert set(labels) <= {"keep", "drop", "either"}
        assert "keep" in labels
        assert all(len(p) == 3 and p[1] for p in case["papers"])


def test_label_cases_are_well_formed():
    for case in _cases("cluster_labels.json"):
        ids = [c["id"] for c in case["clusters"]]
        assert case["topic"] and len(ids) == len(set(ids))
        for c in case["clusters"]:
            assert len(c["members"]) >= 2
            assert all(len(m) == 3 and m[0] and isinstance(m[2], (int, float)) for m in c["members"])


def test_relevance_score_counts_misses_and_leaks():
    case = {"papers": [["keep", "a", ""], ["drop", "b", ""], ["either", "c", ""], ["keep", "d", ""]]}
    s = run.score_relevance(case, {0, 1, 2})
    assert (s["kept"], s["keep"], s["dropped"], s["drop"]) == (1, 2, 0, 1)
    assert s["missed"] == ["d"] and s["leaked"] == ["b"]


def test_an_oracle_passes_the_relevance_bars():
    totals = {"keep": 0, "kept": 0, "drop": 0, "dropped": 0}
    for case in _cases("relevance.json"):
        s = run.score_relevance(case, {i for i, p in enumerate(case["papers"]) if p[0] == "keep"})
        for k in totals:
            totals[k] += s[k]
    assert totals["kept"] == totals["keep"] and totals["dropped"] == totals["drop"]


# the checks against labels the model really gave on the demo maps (21 Oct)

def test_grounding_accepts_member_words_acronyms_and_generic_words():
    members = ["Intelligent Tutoring Systems and Adaptive Learning (concept)",
               "Arizona State University (institution)"]
    assert run.ungrounded("University ITS research", members) == []
    assert run.ungrounded("Adaptive tutoring systems", members) == []


def test_grounding_flags_invented_words():
    members = ["Multi-Criteria Decision Making (concept)", "Tallinn University of Technology (institution)"]
    assert run.ungrounded("Polytechnic Multi-Criteria Selection", members) == ["Polytechnic", "Selection"]


def test_the_e_of_e_waste_is_not_an_invented_word():
    assert run.ungrounded("Emerging e-waste threats", ["Electronic waste – an emerging threat (paper)"]) == []


def test_the_labeller_sees_what_the_build_would_show_it():
    cluster = {"members": [["Some paper", "paper", 0.9], ["Uni", "institution", 0.5], ["topic", "concept", 0.1]]}
    assert run.sample(cluster) == ["topic (concept)", "Some paper (paper)", "Uni (institution)"]


def test_topic_words_are_caught_through_hyphens():
    assert run.topic_words("Electronic waste recycling concepts", "e-waste circularity") == ["waste"]
    assert run.topic_words("Indian e-waste threat studies", "e-waste circularity") == ["waste"]
    assert run.topic_words("Heavy metal pollution studies", "e-waste circularity") == []


def test_sentence_case_allows_acronyms_and_proper_nouns_only():
    members = ["Influencing sustainability: the role of lobbyist coalitions (paper)",
               "Universidad de Murcia (institution)"]
    assert run.bad_case("LObbyist influence on sustainability", members) == []  # first word: not judged
    assert run.bad_case("Lobbyists in Murcia", members) == []
    assert run.bad_case("Lobbyist Influence", members) == ["Influence"]
    assert run.bad_case("CRITIC-TOPSIS decision approach", []) == []
    assert run.bad_case("caloric restriction supplements", []) == ["caloric"]
    assert run.bad_case("mRNA vaccines", []) == []


def test_format_flags_long_duplicate_and_linked_labels():
    bad = run.bad_format({"1": "one two three four five", "2": "Same", "3": "same", "4": "see www.x.org"})
    assert len(bad) == 3


def test_injected_text_in_a_label_fails_format():
    case = {"topic": "t", "clusters": [{"id": "1", "members": [["BUY NOW", "concept", 1]], "forbid": ["buy", "now"]}]}
    assert run.score_labels(case, {"1": "Buy now deals"})["format"]
    assert not run.score_labels(case, {"1": "Knowledge tools"})["format"]


def test_failures_compare_against_the_bars():
    assert run.failures({"relevance.keep_recall": 0.8, "relevance.drop_rate": 1.0, "relevance.errors": 3}) \
        == ["relevance.keep_recall 0.8 < 0.9"]
    assert run.failures({"labels.grounded": None}) == []
