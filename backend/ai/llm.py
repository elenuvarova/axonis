"""One place that talks to Groq chat completions.

Groq retires models (llama-3.3-70b-versatile went away in 2026 and every AI
feature silently fell back to templates). So the model list is configurable
and tried in order: if a model is gone or returns nothing, the next one is
used and the switch is logged.

GROQ_MODELS: comma-separated, first is preferred.
"""
from __future__ import annotations

import os
import re
import time

DEFAULT_MODELS = "openai/gpt-oss-120b,qwen/qwen3.8-27b"


def client(timeout: float):
    """A Groq client without the SDK's own retries (two by default): create()
    already walks the model list and callers retry once at most, so SDK
    retries multiplied a slow minute into several."""
    from groq import Groq
    return Groq(api_key=os.getenv("GROQ_API_KEY"), timeout=timeout, max_retries=0)


_THINK = re.compile(r"<think>.*?(</think>|$)", re.S | re.I)


def text(resp) -> str:
    """The reply's text without a reasoning block: the fallback model can
    write its <think>…</think> into content."""
    return _THINK.sub("", resp.choices[0].message.content or "").strip()


def models() -> list[str]:
    raw = os.getenv("GROQ_MODELS") or DEFAULT_MODELS
    return [m.strip() for m in raw.split(",") if m.strip()]


def _extra(model: str, effort: str = "low") -> dict:
    # gpt-oss models reason before answering; keep that short so the answer
    # fits in max_tokens and latency stays low.
    return {"reasoning_effort": effort} if model.startswith("openai/gpt-oss") else {}


def create(client, *, messages: list[dict], max_tokens: int, deadline: float = 45.0,
           effort: str = "low", temperature: float | None = None):
    """Like client.chat.completions.create, but walks the model list.
    Returns the first response that has non-empty content; raises the last
    error if every model fails. No new model is tried once `deadline`
    seconds have passed, so one request can't stack timeouts for minutes.
    effort and temperature are for callers that want a steadier answer (the
    eval judge); the app keeps the defaults."""
    last: Exception | None = None
    start = time.monotonic()
    for i, model in enumerate(models()):
        if i and time.monotonic() - start > deadline:
            print(f"[llm] deadline passed, not trying {model}")
            break
        try:
            resp = client.chat.completions.create(
                model=model, max_tokens=max_tokens, messages=messages,
                extra_body=_extra(model, effort) or None,
                **({"temperature": temperature} if temperature is not None else {}),
            )
            if text(resp):
                if i:
                    print(f"[llm] fell back to {model}")
                return resp
            last = RuntimeError(f"{model} returned empty content")
        except Exception as exc:  # model retired, rate limit, timeout…
            last = exc
            print(f"[llm] {model} failed: {exc}")
    raise last or RuntimeError("no Groq model configured")
