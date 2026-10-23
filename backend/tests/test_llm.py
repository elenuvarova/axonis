from types import SimpleNamespace
import pytest
from ai import llm


class FakeClient:
    def __init__(self, behaviour):
        self.behaviour = behaviour  # model -> exception | content
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, model, max_tokens, messages, extra_body=None):
        self.calls.append((model, extra_body))
        b = self.behaviour[model]
        if isinstance(b, Exception):
            raise b
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=b))])


def test_falls_back_when_model_is_retired(monkeypatch):
    monkeypatch.setenv("GROQ_MODELS", "openai/gpt-oss-120b,qwen/qwen3.8-27b")
    c = FakeClient({"openai/gpt-oss-120b": RuntimeError("404 model_not_found"), "qwen/qwen3.8-27b": '{"ok":1}'})
    r = llm.create(c, messages=[], max_tokens=10)
    assert r.choices[0].message.content == '{"ok":1}'
    assert c.calls[0] == ("openai/gpt-oss-120b", {"reasoning_effort": "low"})
    assert c.calls[1] == ("qwen/qwen3.8-27b", None)


def test_empty_content_counts_as_failure_and_all_fail_raises(monkeypatch):
    monkeypatch.setenv("GROQ_MODELS", "a,b")
    c = FakeClient({"a": "", "b": RuntimeError("down")})
    with pytest.raises(RuntimeError, match="down"):
        llm.create(c, messages=[], max_tokens=10)


class FakeResponse:
    def __init__(self, status, data):
        self.status_code, self._data = status, data

    def json(self):
        return self._data


def test_gemini_walks_its_own_model_list_and_reads_wrapped_errors(monkeypatch):
    import httpx
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_MODELS", "g-a,g-b")
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    sent = []

    def post(url, *, json, headers, timeout):
        sent.append(json)
        if json["model"] == "g-a":  # Gemini wraps errors in a list
            return FakeResponse(429, [{"error": {"code": 429, "message": "quota exceeded"}}])
        return FakeResponse(200, {"model": "g-b", "choices": [{"message": {"content": "hi"}}]})
    monkeypatch.setattr(httpx, "post", post)
    c = llm.client(timeout=5)
    r = llm.create(c, messages=[{"role": "user", "content": "x"}], max_tokens=10, temperature=0)
    assert c.provider == "gemini" and llm.text(r) == "hi" and r.model == "g-b"
    assert [s["model"] for s in sent] == ["g-a", "g-b"]
    assert sent[1]["temperature"] == 0 and "reasoning_effort" not in sent[1]


def test_app_stays_on_groq_unless_told(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    assert not isinstance(llm.client(timeout=5), llm._Gemini)
    assert isinstance(llm.client(timeout=5, provider_name="gemini"), llm._Gemini)
