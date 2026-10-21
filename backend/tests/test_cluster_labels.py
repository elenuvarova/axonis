"""Cluster labels: short human names, with a fallback and API exposure."""
import json

import models
from ai import cluster_labeler


def test_fallback_label_is_the_lead_member_cut_on_a_word():
    assert cluster_labeler.fallback_label(["Intelligent Tutoring Systems and Adaptive Learning", "x"]) == "Intelligent Tutoring Systems…"
    assert cluster_labeler.fallback_label([]) == "Unnamed cluster"


def test_without_a_key_no_cluster_is_labelled(monkeypatch):
    # unlabelled clusters stay NULL so a backfill can find them; the screen
    # shows the lead member (textutil.cluster_name)
    monkeypatch.setenv("GROQ_API_KEY", "")
    assert cluster_labeler.label_clusters_ai("ai tutoring", [("1", ["Adaptive learning"])]) == {}


def test_ai_labels_are_cleaned(monkeypatch):
    class R:
        def __init__(self, t): self.choices = [type("C", (), {"message": type("M", (), {"content": t})()})()]
    monkeypatch.setenv("GROQ_API_KEY", "k")
    monkeypatch.setattr(cluster_labeler.llm, "create", lambda *a, **k: R('{"1": "\\"Adaptive learning systems.\\"", "2": "one two three four five"}'))
    import groq
    monkeypatch.setattr(groq, "Groq", lambda **k: object())
    out = cluster_labeler.label_clusters_ai("t", [("1", ["a"]), ("2", ["b"])])
    # too long is dropped, not cut mid-phrase
    assert out == {"1": "Adaptive learning systems"}


def test_a_lower_case_label_gets_its_capital():
    assert cluster_labeler._clean("caloric restriction supplements") == "Caloric restriction supplements"
    assert cluster_labeler._clean("mRNA vaccines") == "mRNA vaccines"
    assert cluster_labeler._clean("e-waste policy") == "E-waste policy"


def test_the_prompt_names_the_topic_words_to_leave_out():
    assert cluster_labeler._topic_words("e-waste circularity") == ["waste", "circularity"]
    assert cluster_labeler._topic_words("AI tutoring") == ["tutoring"]


def test_clusters_api_prefers_the_label(client, db):
    p = models.ResearchProject(topic="t", status="ready"); db.add(p); db.commit()
    db.add(models.Cluster(project_id=p.id, cluster_id="1", name="Alpha · Beta", label="Adaptive learning",
                          top_entities=json.dumps(["Alpha", "Beta"]), size=3))
    db.commit()
    c = client.get(f"/api/projects/{p.id}/clusters").json()["clusters"][0]
    assert c["name"] == "Adaptive learning" and c["terms"] == "Alpha · Beta"
