"""Short labels for generated names: cut on a word boundary with an
ellipsis, never mid-word ("Intelligent Tutoring Systems…", not
"Intelligent Tutoring Systems and Adaptiv")."""
from __future__ import annotations

import re

_TRAIL = re.compile(r"[\s,;:·–\-]+$")


def short(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space >= limit // 3:
        cut = cut[:space]
    return _TRAIL.sub("", cut) + "…"


# Names stored before this module existed were sliced hard: cluster parts at
# 40 characters, template titles at 50 + " opportunity". Repair them on read
# so old maps display cleanly without a rebuild.
_OLD_PART = 40
_OLD_TITLE = 50
_SUFFIX = " opportunity"


def repair_cluster_name(name: str | None) -> str | None:
    if not name:
        return name
    parts = name.split(" · ")
    return " · ".join(short(p, 32) if len(p) == _OLD_PART else p for p in parts)


def repair_title(title: str | None) -> str | None:
    if title and title.endswith(_SUFFIX) and len(title) == _OLD_TITLE + len(_SUFFIX):
        return short(title[: -len(_SUFFIX)], 40) + _SUFFIX
    return title
