"""Fill in node descriptions from OpenAlex and Wikidata after a build.

Search results bring a description for only some nodes (about one in ten on
the demo maps): papers, institutions, OpenAlex topics and the Wikidata items
reached through SPARQL arrive with none. Each of those has an ID, so a few
batched lookups at the end fill most of them in:

  papers        first sentence of the OpenAlex abstract, else year and citations
  topics        OpenAlex topic / subfield description, first sentence
  concepts      OpenAlex concept description, or the Wikidata one
  institutions  the Wikidata description when OpenAlex links one, else its
                type and city from OpenAlex ("University in Leuven, Belgium")

Works on anything with name/type/source/description/wikidata_id/openalex_id
(RawEntity before persisting, Entity rows for a backfill). Topic nodes from
older builds carry no ID; they get one by exact name from their papers'
topics. Best effort: a failed lookup leaves that node as it was.
"""
from __future__ import annotations

import re

from sources.http import get_json
from sources.openalex import _get
from sources.wikidata import _HEADERS as _WD_HEADERS, _SEARCH as _WD_API

_BATCH = 50  # OpenAlex OR-filters and wbgetentities both take 50 per call
_MAX_LEN = 300

_INSTITUTION_KIND = {
    "education": "University or college",
    "healthcare": "Healthcare institution",
    "company": "Company",
    "government": "Government body",
    "nonprofit": "Nonprofit organisation",
    "facility": "Research facility",
    "archive": "Archive",
    "funder": "Research funder",
}


def fill(entities: list) -> int:
    """Set .description (and missing OpenAlex topic IDs) in place; returns how
    many descriptions were added."""
    missing = [e for e in entities if not (e.description or "").strip()]
    if not missing:
        return 0
    before = len(missing)
    fallback: dict[int, str] = {}  # id(entity) → institution line
    try:
        _fill_from_openalex(entities, missing, fallback)
    except Exception as exc:  # never fail a build over descriptions
        print(f"[describe] openalex error: {exc}")
    try:
        _fill_from_wikidata([e for e in missing if not e.description])
    except Exception as exc:
        print(f"[describe] wikidata error: {exc}")
    for e in missing:
        if not e.description and fallback.get(id(e)):
            e.description = fallback[id(e)]
    return before - sum(1 for e in missing if not e.description)


def _fill_from_openalex(entities: list, missing: list, fallback: dict[int, str]) -> None:
    papers = [e for e in entities if e.type == "paper" and _oa_kind(e.openalex_id) == "W"]
    works = _lookup("/works", [e.openalex_id for e in papers],
                    "id,abstract_inverted_index,topics,publication_year,cited_by_count")

    # Topic and subfield IDs by name, for topic nodes built before IDs were kept.
    topic_ids: dict[str, str] = {}
    for w in works.values():
        for t in w.get("topics") or []:
            for node in (t, t.get("subfield") or {}):
                if node.get("display_name") and node.get("id"):
                    topic_ids.setdefault(node["display_name"].casefold(), _short_id(node["id"]))
    for e in missing:
        if e.source == "openalex" and e.type == "concept" and not e.openalex_id:
            e.openalex_id = topic_ids.get((e.name or "").casefold())

    for e in missing:
        if e.type == "paper" and e.openalex_id in works:
            w = works[e.openalex_id]
            e.description = _first_sentence(_abstract(w.get("abstract_inverted_index"))) or _paper_line(w)

    by_kind: dict[str, list] = {}
    for e in missing:
        if not e.description and e.type != "paper":
            by_kind.setdefault(_oa_kind(e.openalex_id), []).append(e)

    for kind, path in (("C", "/concepts"), ("T", "/topics"), ("S", "/subfields")):
        found = _lookup(path, [e.openalex_id for e in by_kind.get(kind, [])], "id,description")
        for e in by_kind.get(kind, []):
            e.description = _tidy_topic(_first_sentence((found.get(e.openalex_id) or {}).get("description")))

    institutions = by_kind.get("I", [])
    found = _lookup("/institutions", [e.openalex_id for e in institutions], "id,ids,type,geo")
    for e in institutions:
        inst = found.get(e.openalex_id)
        if not inst:
            continue
        qid = ((inst.get("ids") or {}).get("wikidata") or "").rsplit("/", 1)[-1]
        if re.fullmatch(r"Q\d+", qid) and not e.wikidata_id:
            e.wikidata_id = qid
        fallback[id(e)] = _institution_line(inst)


def _fill_from_wikidata(entities: list) -> None:
    with_qid = [e for e in entities if re.fullmatch(r"Q\d+", e.wikidata_id or "")]
    qids = list(dict.fromkeys(e.wikidata_id for e in with_qid))
    found: dict[str, str] = {}
    for i in range(0, len(qids), _BATCH):
        data = get_json(
            _WD_API,
            params={"action": "wbgetentities", "ids": "|".join(qids[i:i + _BATCH]),
                    "props": "descriptions", "languages": "en", "format": "json"},
            headers={"User-Agent": _WD_HEADERS["User-Agent"]},
            timeout=10,
        )
        for qid, item in ((data or {}).get("entities") or {}).items():
            text = (((item.get("descriptions") or {}).get("en") or {}).get("value") or "").strip()
            if text:
                found[qid] = text
    for e in with_qid:
        e.description = _first_sentence(found.get(e.wikidata_id))


def _lookup(path: str, ids: list, select: str) -> dict[str, dict]:
    """OpenAlex records by short ID ("W123", "T456", "subfields/2311")."""
    ids = list(dict.fromkeys(i for i in ids if i))
    key = "id" if path in ("/topics", "/subfields") else "openalex_id"
    out: dict[str, dict] = {}
    for i in range(0, len(ids), _BATCH):
        chunk = [x.rsplit("/", 1)[-1] for x in ids[i:i + _BATCH]]
        data = _get(path, {"filter": f"{key}:{'|'.join(chunk)}", "select": select, "per-page": _BATCH})
        for r in data.get("results") or []:
            if r.get("id"):
                out[_short_id(r["id"])] = r
    return out


def _short_id(url: str) -> str:
    """https://openalex.org/T123 → T123; …/subfields/2311 → subfields/2311."""
    return url.removeprefix("https://openalex.org/")


def _oa_kind(oa_id: str | None) -> str:
    if not oa_id:
        return ""
    if oa_id.startswith("subfields/"):
        return "S"
    return oa_id[:1] if re.fullmatch(r"[WCTI]\d+", oa_id) else ""


def _abstract(inverted: dict | None) -> str:
    if not inverted:
        return ""
    words: dict[int, str] = {}
    for word, positions in inverted.items():
        for p in positions:
            words[p] = word
    return " ".join(words[p] for p in sorted(words))


def _first_sentence(text: str | None) -> str:
    """The first sentence, cut at a word boundary if it runs long."""
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^(abstract|summary|background|objectives?)\s*[:.\-–]?\s+", "", text, flags=re.I)
    if not text:
        return ""
    # ends of sentences, skipping any that would leave a stub ("Introduction.")
    for m in re.finditer(r"(?<=[a-z0-9\)%][.!?])\s+(?=[A-Z])", text):
        if m.start() >= 40:
            text = text[:m.start()]
            break
    if len(text) > _MAX_LEN:
        text = text[:_MAX_LEN].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return text


def _tidy_topic(text: str) -> str:
    """OpenAlex writes every topic as "This cluster of papers explores …"."""
    return re.sub(r"^This cluster of papers (?:focuses on|explores|examines|investigates|covers|"
                  r"delves into|discusses|addresses|encompasses|studies)\s+", "Papers on ", text)


def _paper_line(work: dict) -> str:
    year, cited = work.get("publication_year"), work.get("cited_by_count")
    if not year:
        return ""
    times = f", cited {cited:,} time{'s' if cited != 1 else ''}" if cited else ""
    return f"Paper from {year}{times}"


def _institution_line(inst: dict) -> str:
    kind = _INSTITUTION_KIND.get(inst.get("type") or "", "Institution")
    geo = inst.get("geo") or {}
    place = ", ".join(p for p in (geo.get("city"), geo.get("country")) if p)
    return f"{kind} in {place}" if place else ""
