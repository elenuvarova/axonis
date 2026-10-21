"""Abuse guards for a public demo without accounts.

- Protected projects (PROTECTED_PROJECT_IDS, comma-separated) are the
  portfolio demos: anyone can read and ask, nobody can delete, rebuild or
  upload into them through the public API.
- Per-IP rate limits on the actions that cost an LLM call or a full build.
  In-process sliding windows, enough for one uvicorn process; limits are
  generous for a person and tight for a script.
- A service-wide daily budget per LLM-backed action, plus a per-map cap on
  Ask, counted in the database (spend). Per-IP limits alone don't stop a
  script spread over many addresses, and they reset on every deploy.
"""
from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

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
    "delete": (30, 3600),
    "analytics": (600, 3600),
}

_lock = threading.Lock()
_hits: dict[tuple[str, str], deque] = defaultdict(deque)
_MAX_KEYS = 50_000  # hard cap on tracked (ip, action) pairs
_last_sweep = 0.0


def _sweep(now: float) -> None:
    """Drop keys whose window has fully expired (call under _lock)."""
    global _last_sweep
    if now - _last_sweep < 60 and len(_hits) < _MAX_KEYS:
        return
    _last_sweep = now
    longest = max(w for _, w in LIMITS.values())
    for key in [k for k, q in _hits.items() if not q or q[-1] <= now - longest]:
        del _hits[key]
    if len(_hits) >= _MAX_KEYS:
        # Still full (a flood of distinct clients). Evict the least recently
        # active tenth instead of clearing everything: clearing would also
        # reset the counters of whoever is being limited right now (fail-open).
        by_age = sorted(_hits.items(), key=lambda kv: kv[1][-1] if kv[1] else 0)
        for key, _ in by_age[: max(1, len(by_age) // 10)]:
            del _hits[key]


def client_ip(request: Request) -> str:
    """The address the nearest trusted proxy saw.

    Each trusted proxy appends the address it received from, so with N
    trusted hops (TRUSTED_PROXY_HOPS, default 1 = Coolify's Traefik) the
    client is the N-th entry from the right. Entries further left are
    whatever the client sent and are ignored; a forged header can't mint a
    fresh identity per request. With no header (direct hit) the socket peer
    is used.
    """
    try:
        hops = max(1, int(os.getenv("TRUSTED_PROXY_HOPS", "1")))
    except ValueError:
        hops = 1
    chain = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    if len(chain) >= hops:
        return chain[-hops]
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
            _sweep(now)
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


# action -> requests per UTC day, across everyone. LLM_DAILY_LIMITS overrides,
# e.g. "ask=3000,build=300".
DAILY = {"build": 150, "upload": 150, "ask": 1500, "brief": 300}
# action -> requests per UTC day on one map
PER_MAP_DAILY = {"ask": 200}


def _daily_limit(action: str) -> int | None:
    for part in (os.getenv("LLM_DAILY_LIMITS") or "").split(","):
        name, _, value = part.partition("=")
        if name.strip() == action and value.strip().isdigit():
            return int(value)
    return DAILY.get(action)


def _bump(key: str, day: str) -> int:
    """Add one to a counter and return the new count."""
    from sqlalchemy import select, update, insert
    from sqlalchemy.exc import IntegrityError
    from database import engine
    from models import UsageCounter
    t = UsageCounter.__table__
    for _ in range(2):  # the insert can race another request's insert
        try:
            with engine.begin() as conn:
                hit = conn.execute(update(t).where(t.c.key == key, t.c.day == day)
                                   .values(count=t.c.count + 1)).rowcount
                if not hit:
                    conn.execute(insert(t).values(key=key, day=day, count=1))
                return conn.execute(select(t.c.count).where(t.c.key == key, t.c.day == day)).scalar_one()
        except IntegrityError:
            continue
    return 0


def spend(action: str, project_id: str | None = None) -> None:
    """Count one LLM-backed action against today's budgets; 503 once the
    service-wide budget or the map's own cap is used up. Call it after the
    request has been validated (owner token, cache hit), so refused or free
    requests don't use up the budget for everyone."""
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    retry = str(int((datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
                     + timedelta(days=1) - now).total_seconds()) + 1)
    limit = _daily_limit(action)
    if limit is not None and _bump(action, day) > limit:
        raise HTTPException(status_code=503, headers={"Retry-After": retry},
                            detail="This feature has reached its daily limit. Please try again tomorrow.")
    per_map = PER_MAP_DAILY.get(action)
    if per_map is not None and project_id and _bump(f"{action}:{project_id}", day) > per_map:
        raise HTTPException(status_code=503, headers={"Retry-After": retry},
                            detail="This map has reached today's limit for questions. Please try again tomorrow.")
