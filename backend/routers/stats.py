"""First-party path for the self-hosted Umami analytics.

Blockers filter third-party analytics hosts, so a share of visits never
reached stats.ontwrpn.com. The tracker is served from this origin
(/s/a.js) and its events posted here (/s/api/send), then forwarded
server-side with the visitor's address and user agent so Umami's country
and device stats stay right. Umami itself is cookieless; nothing extra is
stored here.
"""
from __future__ import annotations

import os
import time

import httpx
from fastapi import APIRouter, Depends, Request, Response

from guard import client_ip, rate_limit

UMAMI = os.getenv("UMAMI_ORIGIN", "https://stats.ontwrpn.com").rstrip("/")
router = APIRouter(prefix="/s", include_in_schema=False)

_script: dict = {"body": b"", "at": 0.0}
_SCRIPT_TTL = 3600


@router.get("/a.js")
async def tracker() -> Response:
    now = time.time()
    if not _script["body"] or now - _script["at"] > _SCRIPT_TTL:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{UMAMI}/script.js")
            if r.status_code == 200 and r.content:
                _script.update(body=r.content, at=now)
        except httpx.HTTPError:
            pass  # serve the last good copy, or an empty script
    return Response(_script["body"] or b"", media_type="application/javascript",
                    headers={"Cache-Control": "public, max-age=3600"})


@router.post("/api/send", dependencies=[Depends(rate_limit("analytics"))])
async def send(request: Request) -> Response:
    body = await request.body()
    headers = {
        "Content-Type": "application/json",
        "User-Agent": request.headers.get("user-agent", ""),
        "X-Forwarded-For": client_ip(request),
    }
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(f"{UMAMI}/api/send", content=body, headers=headers)
        return Response(r.content, status_code=r.status_code,
                        media_type=r.headers.get("content-type", "application/json"))
    except httpx.HTTPError:
        return Response(status_code=204)  # analytics must never break the page
