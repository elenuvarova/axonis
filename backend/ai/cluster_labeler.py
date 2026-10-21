"""Short, human names for clusters.

A cluster is named after its two best-connected members ("Intelligent
Tutoring Systems… · Effective learning with a…"), which reads as machine
output. LLM calls name the clusters in two to four plain words from their
members, sixteen per call. Only clusters the model actually named get a
label; the rest stay unlabelled (NULL in the database), so a later backfill
can tell them apart, and textutil.cluster_name shows the lead member
instead. The member names stay available as the cluster's terms.
"""
from __future__ import annotations

import json
import os
import re
import unicodedata

from ai import llm
from textutil import lead_name

_MAX_WORDS = 4
_MAX_CHARS = 40
_BATCH = 16
_TOKENS = (1200, 2400)  # second attempt gets more room: a cut-off reply rarely fixes itself

# kept for callers and tests that want the stand-in name directly
fallback_label = lead_name


def _clean(label) -> str:
    """A usable label or "": text only, no links or markup, edge quotes and
    emphasis off, at most four words and forty characters."""
    if not isinstance(label, str):
        return ""
    label = unicodedata.normalize("NFKC", label).strip().strip("\"'`*_ ").rstrip(".").strip()
    if not label or "://" in label or "www." in label.lower() or re.search(r"[<>\[\]{}]", label):
        return ""
    words = label.split()
    label = " ".join(words[:_MAX_WORDS])
    return label if len(label) <= _MAX_CHARS else ""


def _unwrap(data) -> dict:
    """{id: label}, also from the shapes reasoning models like to return:
    {"clusters": {...}} or a list of {"id": .., "label": ..}."""
    if isinstance(data, dict) and len(data) == 1:
        inner = next(iter(data.values()))
        if next(iter(data)) in ("clusters", "labels") and isinstance(inner, (dict, list)):
            data = inner
    if isinstance(data, list):
        data = {str(d.get("id")): d.get("label") or d.get("name") for d in data if isinstance(d, dict)}
    return data if isinstance(data, dict) else {}


def label_clusters_ai(topic: str, clusters: list[tuple[str, list[str]]]) -> dict[str, str]:
    """clusters: [(cluster_id, top member names)] -> {cluster_id: label} for
    the clusters the model named. Never raises: labels are a nicety."""
    if not os.getenv("GROQ_API_KEY") or not clusters:
        return {}
    client = llm.client(timeout=25.0)
    labels: dict[str, str] = {}
    for i in range(0, len(clusters), _BATCH):
        labels.update(_label_batch(client, topic, clusters[i:i + _BATCH]))
    # two clusters with one name are ambiguous on screen and in Ask: keep the
    # first (the bigger cluster), let the other show its lead member
    seen: set[str] = set()
    for cid in [cid for cid, _ in clusters if cid in labels]:
        key = labels[cid].casefold()
        if key in seen:
            del labels[cid]
        seen.add(key)
    return labels


def _label_batch(client, topic: str, batch: list[tuple[str, list[str]]]) -> dict[str, str]:
    ids = {str(cid) for cid, _ in batch}
    listing = "\n".join(f'{cid}: {"; ".join(n[:60] for n in names[:5])}' for cid, names in batch)
    for attempt, max_tokens in enumerate(_TOKENS, 1):
        try:
            data = _unwrap(_ask(client, topic, listing, max_tokens))
            labels = {str(cid): _clean(v) for cid, v in data.items() if str(cid) in ids}
            labels = {cid: v for cid, v in labels.items() if v}
            if not labels:
                raise ValueError("no usable label in the reply")
            return labels
        except Exception as exc:
            print(f"[labels] attempt {attempt} failed: {exc}")
    return {}


def _ask(client, topic: str, listing: str, max_tokens: int):
    resp = llm.create(client, max_tokens=max_tokens, messages=[
            {"role": "system", "content": "You name clusters of a knowledge graph for product researchers. "
                                          "Respond with JSON only: an object mapping each cluster id to a label."},
            {"role": "user", "content": (
                f'Domain: "{topic}". Each line is a cluster id and its best-connected members.\n{listing}\n\n'
                "Give each cluster a plain-English label of 2 to 4 words that says what the cluster is about. "
                "Sentence case, no quotes, no trailing full stop, no repeating the domain name itself. "
                'Return e.g. {"3": "Adaptive learning systems", "7": "Teacher feedback tools"}.'
            )},
        ])
    text = llm.text(resp)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in the reply")
    return json.loads(text[start:end + 1])
