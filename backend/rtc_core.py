"""Shared WebRTC plumbing: ICE server config, signaling rate limits and
authenticated call-session bookkeeping.

Media never touches the server — only signaling does. Call sessions are kept
in memory for fast per-signal validation (ICE candidates arrive in bursts) and
mirrored into MongoDB for call history.
"""

import os
import time
import uuid
from datetime import datetime, timezone

from db import calls_col, rooms_col

# --------------------------------------------------------------------------- #
# ICE configuration (STUN + TURN) — always sourced from the environment so no
# TURN credential is ever hardcoded in the client bundle.
# --------------------------------------------------------------------------- #
DEFAULT_STUN = "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"


def ice_servers() -> list[dict]:
    servers: list[dict] = []
    stun = os.environ.get("WEBRTC_STUN_SERVERS", DEFAULT_STUN)
    for url in [u.strip() for u in stun.split(",") if u.strip()]:
        servers.append({"urls": url})
    turn = os.environ.get("WEBRTC_TURN_SERVER", "")
    turn_urls = [u.strip() for u in turn.split(",") if u.strip()]
    if turn_urls:
        servers.append(
            {
                "urls": turn_urls,
                "username": os.environ.get("WEBRTC_TURN_USERNAME", ""),
                "credential": os.environ.get("WEBRTC_TURN_CREDENTIAL", ""),
            }
        )
    return servers


# --------------------------------------------------------------------------- #
# Rate limiting (sliding window, per user + action)
# --------------------------------------------------------------------------- #
class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}

    def allow(self, key: str, limit: int, window: float) -> bool:
        now = time.monotonic()
        hits = [t for t in self._hits.get(key, []) if now - t < window]
        if len(hits) >= limit:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        return True


limiter = RateLimiter()

# Limits: call requests, signaling messages, room create/join.
CALL_REQUEST_LIMIT = (10, 60.0)
SIGNAL_LIMIT = (400, 10.0)
ROOM_ACTION_LIMIT = (20, 60.0)


# --------------------------------------------------------------------------- #
# Call sessions
# --------------------------------------------------------------------------- #
RINGING = "RINGING"
CONNECTED = "CONNECTED"
COMPLETED = "COMPLETED"
MISSED = "MISSED"
REJECTED = "REJECTED"
CANCELLED = "CANCELLED"
FAILED = "FAILED"

TERMINAL = {COMPLETED, MISSED, REJECTED, CANCELLED, FAILED}

# call_id -> {caller, receiver, status, created_at, connected_at}
_sessions: dict[str, dict] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create_session(caller_id: str, receiver_id: str) -> str:
    call_id = str(uuid.uuid4())
    _sessions[call_id] = {
        "caller": caller_id,
        "receiver": receiver_id,
        "status": RINGING,
        "created": time.monotonic(),
        "connected_at": None,
    }
    await calls_col.insert_one(
        {
            "_id": call_id,
            "caller_id": caller_id,
            "receiver_id": receiver_id,
            "kind": "AUDIO",
            "status": RINGING,
            "started_at": _now_iso(),
            "connected_at": None,
            "ended_at": None,
            "duration_ms": None,
        }
    )
    _prune()
    return call_id


def _prune() -> None:
    """Drop sessions older than 2h so the in-memory map can't grow unbounded."""
    cutoff = time.monotonic() - 7200
    for cid, s in list(_sessions.items()):
        if s["created"] < cutoff:
            _sessions.pop(cid, None)


def session(call_id: str) -> dict | None:
    return _sessions.get(call_id)


def is_participant(call_id: str, user_id: str, target_id: str) -> bool:
    """The signal is only relayed when both ends are the two authenticated
    participants of a live (non-terminal) session."""
    s = _sessions.get(call_id)
    if not s or s["status"] in TERMINAL:
        return False
    pair = {s["caller"], s["receiver"]}
    return user_id in pair and target_id in pair and user_id != target_id


async def mark_connected(call_id: str) -> None:
    s = _sessions.get(call_id)
    if not s or s["status"] != RINGING:
        return
    s["status"] = CONNECTED
    s["connected_at"] = time.monotonic()
    await calls_col.update_one(
        {"_id": call_id},
        {"$set": {"status": CONNECTED, "connected_at": _now_iso()}},
    )


async def finish(call_id: str, status: str | None = None) -> None:
    """Close out a session. When `status` is omitted it is derived from whether
    the call ever connected (COMPLETED vs MISSED)."""
    s = _sessions.get(call_id)
    if not s or s["status"] in TERMINAL:
        return
    connected_at = s.get("connected_at")
    final = status or (COMPLETED if connected_at else MISSED)
    duration_ms = int((time.monotonic() - connected_at) * 1000) if connected_at else None
    s["status"] = final
    await calls_col.update_one(
        {"_id": call_id},
        {
            "$set": {
                "status": final,
                "ended_at": _now_iso(),
                "duration_ms": duration_ms,
            }
        },
    )


# --------------------------------------------------------------------------- #
# Voice-room membership validation (cached — ICE arrives in bursts)
# --------------------------------------------------------------------------- #
_room_cache: dict[str, tuple[float, set[str]]] = {}
ROOM_CACHE_TTL = 5.0


async def room_members(room_id: str) -> set[str]:
    cached = _room_cache.get(room_id)
    now = time.monotonic()
    if cached and now - cached[0] < ROOM_CACHE_TTL:
        return cached[1]
    doc = await rooms_col.find_one({"_id": room_id}, {"members": 1, "is_live": 1})
    ids: set[str] = set()
    if doc and doc.get("is_live", True):
        ids = set((doc.get("members") or {}).keys())
    _room_cache[room_id] = (now, ids)
    return ids


async def both_in_room(room_id: str, a: str, b: str) -> bool:
    ids = await room_members(room_id)
    return a in ids and b in ids


def invalidate_room(room_id: str) -> None:
    """Drop the membership cache so a fresh join can signal immediately."""
    _room_cache.pop(room_id, None)
