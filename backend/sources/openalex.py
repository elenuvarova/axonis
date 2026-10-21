"""OpenAlex API — concepts, works (papers), and institutions."""
import os
from sources.http import get_json

_BASE = "https://api.openalex.org"
# Polite pool: a real contact email gets a faster, more reliable rate limit.
# Set OPENALEX_MAILTO in the environment for production.
_MAILTO = os.getenv("OPENALEX_MAILTO", "kge-research@example.com")
_HEADERS = {
    "User-Agent": f"KnowledgeGraphExplorer/1.0 (mailto:{_MAILTO})",
}


def _get(path: str, params: dict) -> dict:
    params = {**params, "mailto": _MAILTO}
    data = get_json(f"{_BASE}{path}", params=params, headers=_HEADERS, timeout=10)
    return data or {}


def search_concepts(query: str, per_page: int = 15) -> list[dict]:
    """Return OpenAlex concepts matching a query string."""
    data = _get("/concepts", {
        "search": query,
        "per-page": per_page,
        "select": "id,display_name,description,level,related_concepts,works_count",
    })
    return data.get("results", [])


def get_top_works(query: str, per_page: int = 20, pool: int = 40) -> list[dict]:
    """Return well-cited papers that are actually about the query.

    Sorting the whole full-text search by citations surfaced famous papers that
    merely mention a word (an RT-PCR methods paper, a supernova survey) on top
    of an "e-waste circularity" map. So: take the `pool` most relevant results
    (OpenAlex's default ranking for `search`), then order those by citations.
    """
    data = _get("/works", {
        "search": query,
        "per-page": pool,
        "select": "id,title,doi,publication_year,cited_by_count,relevance_score,concepts,topics,authorships",
    })
    works = data.get("results", [])
    works.sort(key=lambda w: w.get("cited_by_count") or 0, reverse=True)
    return works[:per_page]


def get_top_institutions(query: str, per_page: int = 10) -> list[dict]:
    """Return institutions active in a research area."""
    data = _get("/institutions", {
        "search": query,
        "sort": "works_count:desc",
        "per-page": per_page,
        "select": "id,display_name,country_code,type,works_count,homepage_url",
    })
    return data.get("results", [])


def merge_works(lists: list[list[dict]]) -> list[dict]:
    """Interleave several result lists (first of each, then second of each…)
    without repeats, so no single query fills the map on its own."""
    seen: set[str] = set()
    merged: list[dict] = []
    for i in range(max((len(l) for l in lists), default=0)):
        for l in lists:
            if i < len(l):
                key = l[i].get("id") or (l[i].get("title") or "").strip().lower()
                if key and key not in seen:
                    seen.add(key)
                    merged.append(l[i])
    return merged


def fetch_entities_for_topic(topic: str, terms: list[str] | tuple = ()) -> dict:
    """
    Fetch concepts, top papers, and key institutions for a topic.
    Returns raw OpenAlex data grouped by type.

    Papers are searched for the topic and its first three expanded terms: a
    topic phrased the way nobody writes papers ("solar land scouting") finds
    only namesakes, its terms ("solar farm site selection") find the field.
    The works are candidates; the caller screens them for relevance.
    """
    concepts = search_concepts(topic)
    queries = [topic] + [t for t in terms if t.strip().lower() != topic.strip().lower()][:3]
    works = merge_works([get_top_works(q, per_page=15) for q in queries])
    institutions = get_top_institutions(topic)

    # Also pull related concepts from the top concept hit
    related_concepts: list[dict] = []
    if concepts:
        # OpenAlex sends related_concepts: null for some concepts
        for rc in (concepts[0].get("related_concepts") or [])[:10]:
            related_concepts.append(rc)

    return {
        "concepts": concepts,
        "related_concepts": related_concepts,
        "works": works,
        "institutions": institutions,
    }
