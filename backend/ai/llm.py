"""One place that talks to chat completions: Groq for the app, Gemini as a
second provider (the eval judge, and a run of the evals on another model).

Groq retires models (llama-3.3-70b-versatile went away in 2026 and every AI
feature silently fell back to templates). So the model list is configurable
and tried in order: if a model is gone or returns nothing, the next one is
used and the switch is logged.

GROQ_MODELS / GEMINI_MODELS: comma-separated, first is preferred.
LLM_PROVIDER: groq (default) or gemini, for clients that don't name one.
"""
from __future__ import annotations

import os
import re
import time
from types import SimpleNamespace

DEFAULT_MODELS = {
    "groq": "openai/gpt-oss-120b,qwen/qwen3.8-27b",
    # 3.5 answers in seconds; 3.8 queued for over a minute on the free tier
    # (23 Oct 2026) and Pro has no free quota.
    "gemini": "gemini-3.5-flash,gemini-3.8-flash",
}
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"


def provider() -> str:
    return os.getenv("LLM_PROVIDER") or "groq"


def client(timeout: float, provider_name: str | None = None):
    """A client for the provider (LLM_PROVIDER unless named). Groq's goes
    without the SDK's own retries (two by default): create()
    already walks the model list and callers retry once at most, so SDK
    retries multiplied a slow minute into several."""
    if (provider_name or provider()) == "gemini":
        return _Gemini(timeout)
    from groq import Groq
    return Groq(api_key=os.getenv("GROQ_API_KEY"), timeout=timeout, max_retries=0)


class _Gemini:
    """Gemini through Google's OpenAI-compatible endpoint, shaped like the
    Groq client as far as create() uses it. No SDK: one POST with httpx."""
    provider = "gemini"

    def __init__(self, timeout: float):
        self.timeout = timeout
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, *, model: str, max_tokens: int, messages: list[dict], extra_body=None, **kwargs):
        import httpx
        r = httpx.post(GEMINI_URL, timeout=self.timeout,
                       headers={"Authorization": f"Bearer {os.getenv('GEMINI_API_KEY')}"},
                       json={"model": model, "max_tokens": max_tokens, "messages": messages,
                             **(extra_body or {}), **kwargs})
        try:
            data = r.json()
        except ValueError:
            data = {}
        if isinstance(data, list):  # errors come wrapped in a list
            data = data[0] if data else {}
        if r.status_code != 200 or "error" in data:
            raise RuntimeError(f"{r.status_code} {str((data.get('error') or {}).get('message', ''))[:160]}")
        return SimpleNamespace(model=data.get("model") or model, choices=[
            SimpleNamespace(message=SimpleNamespace(content=c.get("message", {}).get("content")))
            for c in data.get("choices", [])])


_THINK = re.compile(r"<think>.*?(</think>|$)", re.S | re.I)


def text(resp) -> str:
    """The reply's text without a reasoning block: the fallback model can
    write its <think>…</think> into content."""
    return _THINK.sub("", resp.choices[0].message.content or "").strip()


def models(provider_name: str = "groq") -> list[str]:
    raw = os.getenv(f"{provider_name.upper()}_MODELS") or DEFAULT_MODELS[provider_name]
    return [m.strip() for m in raw.split(",") if m.strip()]


def _extra(model: str, effort: str = "low") -> dict:
    # gpt-oss and Gemini models reason before answering; keep that short so
    # the answer fits in max_tokens and latency stays low.
    return {"reasoning_effort": effort} if model.startswith(("openai/gpt-oss", "gemini-")) else {}


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
    for i, model in enumerate(models(getattr(client, "provider", "groq"))):
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
    raise last or RuntimeError("no model configured")
