"""
Retrieval-augmented Q&A over a project's knowledge graph.

Retrieval is lexical (no embedding infra, so it stays free and light on Render's
tier): entities are ranked by how well their name/description match the question,
boosted by graph centrality. Groq then answers grounded in the retrieved nodes;
without a key it falls back to a template answer. Either way the retrieved node
ids are returned so the frontend can highlight them on the graph.
"""
from __future__ import annotations
from ai import llm
import os
import re

_TOP_K = 10

_STOP = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
    "what", "which", "who", "how", "why", "when", "where", "does", "do", "can",
    "with", "about", "this", "that", "these", "those", "from", "into", "between",
    "their", "there", "they", "it", "its", "as", "by", "be", "has", "have",
}

_SYSTEM = (
    "You answer questions for a product researcher using ONLY the provided "
    "knowledge-graph context. If the context does not contain the answer, say so "
    "plainly. Be concise (3-5 sentences) and do not invent entities. "
    "The context is a map: numbered nodes plus a summary of clusters and scored "
    "opportunities. A 'gap' is a cluster with research (papers, institutions) "
    "but few or no products; the summary gives those counts. The scored gaps "
    "are listed as 'Gap 01', 'Gap 02'…: refer to them by those names, as the "
    "app does. When nodes or "
    "clusters are listed, answer from them and say where the map is thin; do "
    "not reply that the context has no information. Write plain prose: no "
    "markdown, no bold, no bullet lists. Cite only the numbered nodes, as [n] "
    "with plain square brackets; never cite the summary. "
    "Each context line starts with a number in brackets. After every claim, cite "
    "the lines it rests on with those markers, e.g. [2] or [1][4]. Cite only "
    "numbers that appear in the context."
)

_CITE = re.compile(r"\[(\d{1,2})\]")


def normalise(answer: str) -> str:
    """Models drift from the requested format: full-width 【3】 brackets, a
    cited "[Map]", markdown bold and bullets. The panel renders plain text, so
    fold all of that back to prose with ASCII [n] markers."""
    a = re.sub(r"【\s*(\d{1,2})\s*】", r"[\1]", answer)
    a = re.sub(r"\s*[\[【]\s*(?:map|summary|context)\s*[\]】]", "", a, flags=re.I)
    a = re.sub(r"\*\*(.+?)\*\*", r"\1", a)
    a = re.sub(r"(?m)^[ \t]*[*\-•][ \t]+", "", a)
    a = re.sub(r"\n{2,}", "\n\n", a)
    return a.strip()


def clean_citations(answer: str, n_sources: int) -> str:
    """Drop citation markers that point outside the numbered context, so every
    marker the UI renders maps to a real node."""
    def keep(m: re.Match) -> str:
        return m.group(0) if 1 <= int(m.group(1)) <= n_sources else ""
    return re.sub(r"[ \t]+([.,;:])", r"\1", _CITE.sub(keep, answer)).strip()


def _tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) > 2 and t not in _STOP]


def retrieve(entities: list, question: str, k: int = _TOP_K) -> list:
    q_tokens = set(_tokens(question))
    if not q_tokens:
        return sorted(entities, key=lambda e: e.degree or 0.0, reverse=True)[:k]

    scored = []
    for e in entities:
        name = (e.name or "").lower()
        desc = (e.description or "").lower()
        score = 0.0
        for t in q_tokens:
            if t in name:
                score += 3.0
            if t in desc:
                score += 1.0
        if score > 0:
            score += min(e.degree or 0.0, 1.0)  # gentle centrality tiebreak
            scored.append((score, e))

    if not scored:
        return sorted(entities, key=lambda e: e.degree or 0.0, reverse=True)[:k]

    scored.sort(key=lambda x: x[0], reverse=True)
    return [e for _, e in scored[:k]]


def _summary(entities: list, clusters: list, opportunities: list) -> str:
    """Un-numbered map overview so questions about structure (gaps, themes,
    bridges) have something to reason over, not just ten node descriptions."""
    from collections import Counter
    counts = Counter(e.type for e in entities)
    lines = ["Map: " + ", ".join(f"{n} {t}" for t, n in counts.most_common())]
    ranked = sorted(clusters, key=lambda c: c.opportunity_score or 0, reverse=True)[:6]
    for c in ranked:
        lines.append(f"Cluster '{getattr(c, 'label', None) or c.name}': {c.size} nodes, {c.research_count} research, "
                     f"{c.product_count} products, opportunity {round((c.opportunity_score or 0) * 100)}/100")
    # numbered as the app numbers them (Gap 01 = highest score), so the
    # answer and the screen use the same names
    for i, o in enumerate(sorted(opportunities, key=lambda o: o.score or 0, reverse=True)[:4], 1):
        lines.append(f"Gap {i:02d}: {o.title} ({round((o.score or 0) * 100)}/100, risk {o.risk_level})")
    return "\n".join(lines)


def answer_question(project, entities: list, question: str, clusters: list | None = None,
                    opportunities: list | None = None) -> dict:
    top = retrieve(entities, question)
    cluster_name = {c.cluster_id: (getattr(c, 'label', None) or c.name) for c in (clusters or [])}
    # Numbered so the model can cite lines as [n]; sources keep the same order.
    nodes = "\n".join(
        f"[{i}] {e.name} ({e.type}"
        + (f", cluster '{cluster_name[e.cluster_id]}'" if e.cluster_id in cluster_name else "")
        + f", degree {round(e.degree or 0, 3)}): {(e.description or 'no description')[:200]}"
        for i, e in enumerate(top, 1)
    )
    context = nodes + "\n\n" + _summary(entities, clusters or [], opportunities or [])

    answer = _ai_answer(project.topic, question, context)
    if not answer:
        answer = _template_answer(question, top)
    answer = clean_citations(normalise(answer), len(top))

    return {
        "answer": answer,
        "highlighted_nodes": [e.id for e in top],
        "sources": [{"n": i, "id": e.id, "name": e.name, "type": e.type} for i, e in enumerate(top, 1)],
    }


def _ai_answer(topic: str, question: str, context: str) -> str | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=api_key, timeout=20.0)
        response = llm.create(client,
            max_tokens=512,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": (
                    f'Domain: "{topic}".\n\n'
                    f"Knowledge-graph context:\n{context}\n\n"
                    f"Question: {question}"
                )},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        print(f"[qa] groq error: {exc}")
        return None


def _template_answer(question: str, top: list) -> str:
    if not top:
        return "There isn't enough in this graph to answer that yet. Try building or uploading more data."
    names = ", ".join(f"{e.name} [{i}]" for i, e in enumerate(top[:5], 1))
    return (
        f"The most relevant parts of the graph for your question are: {names}. "
        f"Select a highlighted node to read its description and connections. "
        f"(Set a GROQ_API_KEY to get a written answer synthesised from these.)"
    )
