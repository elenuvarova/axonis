"""Abuse guards for a public demo without accounts.

- Protected projects (PROTECTED_PROJECT_IDS, comma-separated) are the
  portfolio demos: anyone can read and ask, nobody can delete, rebuild or
  upload into them through the public API.
- Per-IP rate limits on the actions that cost an LLM call or a full build.
  In-process sliding windows, enough for one uvicorn process; limits are
  generous for a person and tight for a script.
"""
from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


def protected_ids() -> set[str]:
    return {p.strip() for p in (os.getenv("PROTECTED_PROJECT_IDS") or "").split(",") if p.strip()}


def is_protected(project_id: str) -> bool:
    return project_id in protected_ids()


def forbid_if_protected(project_id: str, action: str) -> None:
    if is_protected(project_id):
        raise HTTPException(status_code=403, detail=f"This is a demo map; {action} is disabled. Build your own map from the home page.")


# action -> (max requests, window seconds)
LIMITS = {
    "create": (10, 3600),
    "build": (6, 3600),
    "upload": (6, 3600),
    "ask": (30, 3600),
    "brief": (20, 3600),
}

_lock = threading.Lock()
_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    # Behind Coolify's Traefik the client is the first X-Forwarded-For hop.
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(action: str):
    """FastAPI dependency: 429 once an IP exceeds LIMITS[action]."""
    def dep(request: Request) -> None:
        if os.getenv("RATE_LIMITS_OFF") == "1":
            return
        limit, window = LIMITS[action]
        now = time.time()
        key = (client_ip(request), action)
        with _lock:
            q = _hits[key]
            while q and q[0] <= now - window:
                q.popleft()
            if len(q) >= limit:
                retry = int(q[0] + window - now) + 1
                raise HTTPException(status_code=429, detail=f"Too many requests; try again in {retry // 60 + 1} min.",
                                    headers={"Retry-After": str(retry)})
            q.append(now)
    return dep


def reset() -> None:
    """Tests only."""
    with _lock:
        _hits.clear()
