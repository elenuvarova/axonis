"""Short, human names for clusters.

A cluster is named after its two best-connected members ("Intelligent
Tutoring Systems… · Effective learning with a…"), which reads as machine
output. One LLM call names every cluster in two to four plain words from
its members; without a key (or if the call fails) the best-connected
concept, cut on a word boundary, stands in. The member names stay
available as the cluster's terms.
"""
from __future__ import annotations

import json
import os
import re

from ai import llm
from textutil import short

_MAX_WORDS = 4


def fallback_label(top_names: list[str]) -> str:
    return short(top_names[0], 32) if top_names else "Unnamed cluster"


def _clean(label: str) -> str:
    label = re.sub(r"[\"'`*_#]", "", label or "").strip().rstrip(".")
    words = label.split()
    return " ".join(words[:_MAX_WORDS]) if words else ""


def label_clusters_ai(topic: str, clusters: list[tuple[str, list[str]]]) -> dict[str, str]:
    """clusters: [(cluster_id, top member names)] -> {cluster_id: label}."""
    labels = {cid: fallback_label(names) for cid, names in clusters}
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or not clusters:
        return labels
    listing = "\n".join(f'{cid}: {"; ".join(n[:60] for n in names[:5])}' for cid, names in clusters[:16])
    try:
        from groq import Groq
        client = Groq(api_key=api_key, timeout=20.0)
        resp = llm.create(client, max_tokens=400, messages=[
            {"role": "system", "content": "You name clusters of a knowledge graph for product researchers. "
                                          "Respond with JSON only: an object mapping each cluster id to a label."},
            {"role": "user", "content": (
                f'Domain: "{topic}". Each line is a cluster id and its best-connected members.\n{listing}\n\n'
                "Give each cluster a plain-English label of 2 to 4 words that says what the cluster is about. "
                "Sentence case, no quotes, no trailing full stop, no repeating the domain name itself. "
                'Return e.g. {"3": "Adaptive learning systems", "7": "Teacher feedback tools"}.'
            )},
        ])
        text = resp.choices[0].message.content.strip()
        data = json.loads(text[text.find("{"): text.rfind("}") + 1])
        for cid, label in data.items():
            cleaned = _clean(str(label))
            if str(cid) in labels and cleaned:
                labels[str(cid)] = cleaned
    except Exception as exc:  # labels are a nicety; never fail a build over them
        print(f"[labels] fell back to member names: {exc}")
    return labels
