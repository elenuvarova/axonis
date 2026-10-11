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
