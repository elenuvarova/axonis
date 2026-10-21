"""In-process build progress, so the build screen can show the real pipeline
stage and real counts instead of a timer.

Builds run as FastAPI background tasks inside the same (single) uvicorn
process that answers GET /api/projects/{id}, so a module-level store is
enough. If the process restarts mid-build the progress is gone, but so is the
build itself. Nothing here is persisted.
"""
from __future__ import annotations

import threading
import time

# Ordered pipeline stages. Keys are what the frontend matches on.
STAGES = [
    ("expand", "Expanding the topic into search terms"),
    ("wikidata", "Fetching concepts from Wikidata"),
    ("openalex", "Querying OpenAlex for research & institutions"),
    ("resolve", "Resolving & de-duplicating entities"),
    ("persist", "Saving entities & relationships"),
    ("metrics", "Computing graph metrics & clusters"),
    ("insights", "Scoring opportunities & writing AI insights"),
]
_STAGE_KEYS = [k for k, _ in STAGES]

_lock = threading.Lock()
_runs: dict[str, dict] = {}


def start(project_id: str) -> None:
    with _lock:
        _runs[project_id] = {"stage": _STAGE_KEYS[0], "started_at": time.time(), "counts": {}, "log": []}


def stage(project_id: str, key: str, message: str | None = None) -> None:
    """Enter a pipeline stage; optionally log a line for it."""
    with _lock:
        run = _runs.get(project_id)
        if run is None:
            return
        run["stage"] = key
    if message:
        log(project_id, key, message)


def log(project_id: str, source: str, message: str, **counts: int) -> None:
    """Append a real event line; `counts` update the running totals."""
    with _lock:
        run = _runs.get(project_id)
        if run is None:
            return
        run["counts"].update(counts)
        run["log"].append({"t": time.time(), "source": source, "message": message})
        del run["log"][:-40]  # keep the tail; the screen shows the last lines


def finish(project_id: str) -> None:
    with _lock:
        _runs.pop(project_id, None)


def snapshot(project_id: str) -> dict | None:
    with _lock:
        run = _runs.get(project_id)
        if run is None:
            return None
        return {
            "stage": run["stage"],
            "stage_index": _STAGE_KEYS.index(run["stage"]),
            "stages": [{"key": k, "label": label} for k, label in STAGES],
            "started_at": run["started_at"],
            "counts": dict(run["counts"]),
            "log": list(run["log"]),
        }


# Outcome of the last document upload per map, for the page that sent it:
# "Added 12 entities" or why nothing was added. Kept until the next upload or
# build; a restart forgets it, which costs only the toast.
_uploads: dict[str, dict] = {}


def upload_result(project_id: str, filename: str, added: int | None = None, error: str | None = None) -> None:
    with _lock:
        _uploads[project_id] = {"filename": filename, "added": added, "error": error}


def clear_upload(project_id: str) -> None:
    with _lock:
        _uploads.pop(project_id, None)


def last_upload(project_id: str) -> dict | None:
    with _lock:
        u = _uploads.get(project_id)
        return dict(u) if u else None
