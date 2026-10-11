"""One place that talks to Groq chat completions.

Groq retires models (llama-3.3-70b-versatile went away in 2026 and every AI
feature silently fell back to templates). So the model list is configurable
and tried in order: if a model is gone or returns nothing, the next one is
used and the switch is logged.

GROQ_MODELS: comma-separated, first is preferred.
"""
from __future__ import annotations

import os

DEFAULT_MODELS = "openai/gpt-oss-120b,qwen/qwen3.8-27b"


def models() -> list[str]:
    raw = os.getenv("GROQ_MODELS") or DEFAULT_MODELS
    return [m.strip() for m in raw.split(",") if m.strip()]


def _extra(model: str) -> dict:
    # gpt-oss models reason before answering; keep that short so the answer
    # fits in max_tokens and latency stays low.
    return {"reasoning_effort": "low"} if model.startswith("openai/gpt-oss") else {}


def create(client, *, messages: list[dict], max_tokens: int):
    """Like client.chat.completions.create, but walks the model list.
    Returns the first response that has non-empty content; raises the last
    error if every model fails."""
    last: Exception | None = None
    for i, model in enumerate(models()):
        try:
            resp = client.chat.completions.create(
                model=model, max_tokens=max_tokens, messages=messages,
                extra_body=_extra(model) or None,
            )
            content = (resp.choices[0].message.content or "").strip()
            if content:
                if i:
                    print(f"[llm] fell back to {model}")
                return resp
            last = RuntimeError(f"{model} returned empty content")
        except Exception as exc:  # model retired, rate limit, timeout…
            last = exc
            print(f"[llm] {model} failed: {exc}")
    raise last or RuntimeError("no Groq model configured")
