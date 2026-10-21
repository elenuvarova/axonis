"""Regression evals for the LLM prompts: paper screening and cluster names.

Run before changing a prompt, GROQ_MODELS or the model list, and after:
    python -m evals.run                 # both suites
    python -m evals.run relevance       # one suite
    python -m evals.run labels --pause 20
Calls the real model (needs GROQ_API_KEY) on the cases in evals/*.json and
checks properties, not exact strings. Prints every miss, appends a summary
line to evals/runs.jsonl (commit it with the prompt change) and exits 1 when
a pass bar below is missed. A model error (rate limit, outage) is counted
apart from a wrong answer: it says nothing about the prompt.
"""
from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from types import SimpleNamespace

from ai import cluster_labeler, llm, relevance
from graph.clustering import label_sample

HERE = Path(__file__).parent

# Pass bars, decided before looking at results. Judgement calls never reach
# 100%, so the quality bars sit below it; format is all or nothing.
BARS = {
    "relevance.keep_recall": 0.90,     # on-topic papers kept
    "relevance.drop_rate": 0.90,       # namesakes dropped
    "labels.coverage": 0.90,           # clusters that got a label
    "labels.grounded": 0.85,           # every content word traces to a member
    "labels.no_topic_words": 0.90,     # the prompt asks to leave the domain out
    "labels.sentence_case": 0.90,
    "labels.format": 1.0,              # 1-4 words, no links, unique per map
}

# Words a label may use without a member saying them: they describe the kind
# of cluster, not its subject.
GENERIC = {
    "research", "researchers", "studies", "study", "concepts", "concept", "institutions",
    "institutes", "universities", "university", "methods", "approaches", "analysis",
    "applications", "tools", "overview", "overviews", "topics", "theory", "practices",
    "papers", "groups", "centers", "centres", "labs", "work", "projects", "initiatives",
}
STOP = {"a", "an", "the", "and", "of", "in", "on", "for", "to", "with", "by", "at", "from", "or", "&", "vs"}


# ---------------------------------------------------------------- relevance

def score_relevance(case: dict, kept: set[int]) -> dict:
    """Counts for one case: kept/missed keepers, dropped/let-through namesakes."""
    out = {"keep": 0, "kept": 0, "drop": 0, "dropped": 0, "missed": [], "leaked": []}
    for i, (label, title, _field) in enumerate(case["papers"]):
        if label == "keep":
            out["keep"] += 1
            if i in kept:
                out["kept"] += 1
            else:
                out["missed"].append(title)
        elif label == "drop":
            out["drop"] += 1
            if i in kept:
                out["leaked"].append(title)
            else:
                out["dropped"] += 1
    return out


def run_relevance(cases: list[dict], pause: float) -> dict:
    totals = {"keep": 0, "kept": 0, "drop": 0, "dropped": 0, "errors": 0}
    for n, case in enumerate(cases):
        if n:
            time.sleep(pause)
        works = [{"title": t, "topics": [{"field": {"display_name": f}}] if f else []}
                 for _, t, f in case["papers"]]
        kept = relevance._ask_model(case["topic"], works)
        if kept is None:
            totals["errors"] += 1
            print(f"  ! {case['topic']}: model error, case not scored")
            continue
        s = score_relevance(case, kept)
        for k in ("keep", "kept", "drop", "dropped"):
            totals[k] += s[k]
        print(f"  {case['topic']}: kept {s['kept']}/{s['keep']}, dropped {s['dropped']}/{s['drop']}")
        for t in s["missed"]:
            print(f"    - missed: {t[:100]}")
        for t in s["leaked"]:
            print(f"    + leaked: {t[:100]}")
    return {
        "relevance.keep_recall": _rate(totals["kept"], totals["keep"]),
        "relevance.drop_rate": _rate(totals["dropped"], totals["drop"]),
        "relevance.errors": totals["errors"],
    }


# ------------------------------------------------------------------- labels

def _words(text: str) -> list[str]:
    return re.findall(r"[\w][\w'-]*", text)


def _stem(word: str) -> str:
    return word.casefold()[:5]


def _initials(text: str) -> str:
    return "".join(w[0] for w in _words(text) if w.casefold() not in STOP).casefold()


def ungrounded(label: str, members: list[str]) -> list[str]:
    """Content words of the label that no member backs: not a member word
    (compared on a five-letter stem), not an acronym of member words, not a
    generic kind-of-cluster word."""
    text = " ".join(members)
    stems = {_stem(p) for w in _words(text) for p in [w, *w.split("-")] if p}
    initials = " ".join(_initials(m) for m in members)
    out = []
    for word in _words(label):
        parts = [p for p in word.split("-") if p] or [word]
        for p in parts:
            low = p.casefold()
            if len(p) < 2 or low in STOP or low in GENERIC or _stem(p) in stems:
                continue
            if p.isupper() and len(p) >= 2 and (low in initials.replace(" ", "") or low in text.casefold()):
                continue
            out.append(p)
    return out


def topic_words(label: str, topic: str) -> list[str]:
    parts = lambda text: [p for w in _words(text) for p in w.split("-") if p]
    banned = {_stem(p) for p in parts(topic) if len(p) >= 3 and p.casefold() not in STOP}
    return [p for p in parts(label) if _stem(p) in banned]


def bad_case(label: str, members: list[str]) -> list[str]:
    """A lower-case first word, or words after it capitalised without reason:
    not an acronym and not capitalised in the members (a proper noun)."""
    text = " ".join(members)
    words = _words(label)
    first = words[:1] if words and words[0].islower() else []
    return first + [w for w in words[1:]
                    if w[:1].isupper() and not w.isupper() and not re.search(rf"\b{re.escape(w)}\b", text)]


def bad_format(labels: dict[str, str]) -> list[str]:
    problems = []
    seen = set()
    for cid, label in labels.items():
        words = label.split()
        if not 1 <= len(words) <= 4 or "://" in label or "www." in label.casefold():
            problems.append(f"{cid}: {label!r}")
        if label.casefold() in seen:
            problems.append(f"{cid}: duplicate {label!r}")
        seen.add(label.casefold())
    return problems


def sample(cluster: dict) -> list[str]:
    """What the labeller sees of a cluster, picked as the build picks it."""
    return label_sample([SimpleNamespace(name=n, type=t, degree=d) for n, t, d in cluster["members"]])


def score_labels(case: dict, labels: dict[str, str]) -> dict:
    members = {c["id"]: sample(c) for c in case["clusters"]}
    forbid = {c["id"]: c.get("forbid", []) for c in case["clusters"]}
    out = {"clusters": len(members), "named": 0, "grounded": 0, "no_topic": 0, "case_ok": 0,
           "format": bad_format(labels), "notes": []}
    # injected text in member names must not reach a label
    out["format"] += [f"{cid}: obeyed injected text {label!r}" for cid, label in labels.items()
                      if {w.casefold() for w in _words(label)} & set(forbid.get(cid, []))]
    for cid, label in labels.items():
        if cid not in members:
            continue
        out["named"] += 1
        miss = ungrounded(label, members[cid])
        tw = topic_words(label, case["topic"])
        bc = bad_case(label, members[cid])
        out["grounded"] += not miss
        out["no_topic"] += not tw
        out["case_ok"] += not bc
        flags = ([f"ungrounded {miss}"] if miss else []) + ([f"topic words {tw}"] if tw else []) \
            + ([f"case {bc}"] if bc else [])
        if flags:
            out["notes"].append(f"{cid} {label!r}: " + "; ".join(flags))
    for cid in members:
        if cid not in labels:
            out["notes"].append(f"{cid}: no label")
    return out


def run_labels(cases: list[dict], pause: float) -> dict:
    t = {"clusters": 0, "named": 0, "grounded": 0, "no_topic": 0, "case_ok": 0, "format_bad": 0,
         "errors": 0}
    for n, case in enumerate(cases):
        if n:
            time.sleep(pause)
        batch = [(c["id"], sample(c), len(c["members"])) for c in case["clusters"]]
        labels = cluster_labeler.label_clusters_ai(case["topic"], batch)
        if not labels:
            t["errors"] += 1
            print(f"  ! {case['topic']}: model error, case not scored")
            continue
        s = score_labels(case, labels)
        for k in ("clusters", "named", "grounded", "no_topic", "case_ok"):
            t[k] += s[k]
        t["format_bad"] += len(s["format"])
        print(f"  {case['topic']}: named {s['named']}/{s['clusters']}, grounded {s['grounded']}, "
              f"no topic words {s['no_topic']}, sentence case {s['case_ok']}")
        for line in s["format"]:
            print(f"    ✗ format: {line}")
        for line in s["notes"]:
            print(f"    · {line}")
    return {
        "labels.coverage": _rate(t["named"], t["clusters"]),
        "labels.grounded": _rate(t["grounded"], t["named"]),
        "labels.no_topic_words": _rate(t["no_topic"], t["named"]),
        "labels.sentence_case": _rate(t["case_ok"], t["named"]),
        "labels.format": 1.0 if t["named"] and not t["format_bad"] else 0.0,
        "labels.errors": t["errors"],
    }


# --------------------------------------------------------------------- main

def _rate(n: int, d: int) -> float | None:
    return round(n / d, 3) if d else None


def prompt_version() -> str:
    """Hash of the code that builds both prompts, including which cluster
    members the labeller sees: changes whenever a prompt does."""
    src = inspect.getsource(relevance._ask_model) + inspect.getsource(cluster_labeler._ask) \
        + inspect.getsource(cluster_labeler._line) + inspect.getsource(relevance._line) \
        + inspect.getsource(label_sample)
    return hashlib.sha1(src.encode()).hexdigest()[:8]


def _commit() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True,
                              text=True, cwd=HERE).stdout.strip()
    except OSError:
        return ""


def failures(metrics: dict) -> list[str]:
    return [f"{k} {metrics[k]} < {bar}" for k, bar in BARS.items()
            if k in metrics and metrics[k] is not None and metrics[k] < bar]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("suites", nargs="*", help="relevance, labels (default: both)")
    ap.add_argument("--pause", type=float, default=10.0,
                    help="seconds between model calls; the Groq free tier allows 8k tokens a minute")
    ap.add_argument("--no-log", action="store_true", help="don't append to evals/runs.jsonl")
    args = ap.parse_args(argv)
    if not os.getenv("GROQ_API_KEY"):
        print("GROQ_API_KEY is not set: the evals call the real model", file=sys.stderr)
        return 2
    suites = args.suites or ["relevance", "labels"]
    if set(suites) - {"relevance", "labels"}:
        ap.error("suites are relevance and labels")
    metrics: dict = {}
    for suite in suites:
        print(f"\n== {suite}")
        cases = json.loads((HERE / ("relevance.json" if suite == "relevance" else "cluster_labels.json"))
                           .read_text())["cases"]
        metrics.update((run_relevance if suite == "relevance" else run_labels)(cases, args.pause))
    failed = failures(metrics)
    record = {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "commit": _commit(),
              "prompt_version": prompt_version(), "models": llm.models(), "metrics": metrics,
              "passed": not failed}
    print("\n== result")
    for k, v in metrics.items():
        bar = BARS.get(k)
        print(f"  {k}: {v}" + (f"  (bar {bar})" if bar is not None else ""))
    print("  PASS" if not failed else "  FAIL: " + ", ".join(failed))
    if not args.no_log:
        with open(HERE / "runs.jsonl", "a") as f:
            f.write(json.dumps(record) + "\n")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
