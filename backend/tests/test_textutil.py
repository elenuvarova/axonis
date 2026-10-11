from textutil import repair_cluster_name, repair_title, short


def test_short_cuts_on_a_word_boundary():
    assert short("Intelligent Tutoring Systems and Adaptive Learning", 32) == "Intelligent Tutoring Systems…"
    assert short("education", 32) == "education"
    assert short("Pneumonoultramicroscopicsilicovolcanoconiosis", 20) == "Pneumonoultramicros…"


def test_repairs_names_stored_with_a_hard_slice():
    old = "Intelligent Tutoring Systems and Adaptiv · Effective learning with a personal AI tu"
    assert repair_cluster_name(old) == "Intelligent Tutoring Systems… · Effective learning with a…"
    assert repair_cluster_name("software · intelligent tutoring system") == "software · intelligent tutoring system"


def test_repairs_template_titles_stored_with_a_hard_slice():
    old = "A Constructivist Model for Redesigning AI Tutors i opportunity"
    assert repair_title(old) == "A Constructivist Model for Redesigning… opportunity"
    assert repair_title("Adaptive learning") == "Adaptive learning"
