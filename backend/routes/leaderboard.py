"""
Weekly XP Leaderboard.

XP sources (mirrors vocab._compute_stats):
- vocab_lesson_prog rows completed this ISO week (Mon–Sun UTC) → xp_awarded
  (includes WOTD claims which are folded into the same collection)
- vocab_progress rows marked "known" this week → +2 XP each

Endpoints:
  GET /leaderboard/weekly?scope=global|friends
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from auth_utils import get_current_user
from db import db, follows_col, users_col
from models import user_card

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])
CurrentUser = Annotated[dict, Depends(get_current_user)]

vocab_lesson_prog_col = db["vocab_lesson_prog"]
vocab_progress_col = db["vocab_progress"]


def _week_day_keys(now: datetime) -> tuple[list[str], str, str]:
    """Return the 7 YYYY-MM-DD keys of the current ISO week (Mon..Sun)."""
    monday = (now - timedelta(days=now.weekday())).date()
    keys = [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    return keys, keys[0], keys[-1]


async def _weekly_xp_by_user(day_keys: list[str], user_ids: list[str] | None) -> dict[str, int]:
    """Sum weekly XP per user, optionally restricted to `user_ids`."""
    xp: dict[str, int] = {}

    lesson_match: dict[str, Any] = {
        "completed_at_day": {"$in": day_keys},
        "status": "completed",
    }
    word_match: dict[str, Any] = {"date_key": {"$in": day_keys}, "status": "known"}
    if user_ids is not None:
        lesson_match["user_id"] = {"$in": user_ids}
        word_match["user_id"] = {"$in": user_ids}

    async for row in vocab_lesson_prog_col.aggregate([
        {"$match": lesson_match},
        {"$group": {"_id": "$user_id", "xp": {"$sum": "$xp_awarded"}}},
    ]):
        xp[row["_id"]] = xp.get(row["_id"], 0) + int(row.get("xp") or 0)

    async for row in vocab_progress_col.aggregate([
        {"$match": word_match},
        {"$group": {"_id": "$user_id", "n": {"$sum": 1}}},
    ]):
        xp[row["_id"]] = xp.get(row["_id"], 0) + int(row.get("n") or 0) * 2

    return xp


@router.get("/weekly")
async def weekly_leaderboard(current: CurrentUser, scope: str = "global") -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    day_keys, week_start, week_end = _week_day_keys(now)
    uid = current["_id"]

    user_ids: list[str] | None = None
    if scope == "friends":
        follows = await follows_col.find({"follower_id": uid}).to_list(1000)
        user_ids = list({f["following_id"] for f in follows} | {uid})

    xp_map = await _weekly_xp_by_user(day_keys, user_ids)
    ranked = sorted(xp_map.items(), key=lambda kv: kv[1], reverse=True)

    # My rank/xp — even when I have 0 XP this week.
    my_xp = xp_map.get(uid, 0)
    my_rank = None
    for i, (u, _) in enumerate(ranked):
        if u == uid:
            my_rank = i + 1
            break

    top = ranked[:50]
    top_ids = [u for u, _ in top]
    user_docs = await users_col.find({"_id": {"$in": top_ids}}).to_list(len(top_ids))
    users_by_id = {u["_id"]: u for u in user_docs}

    entries = []
    for i, (u, points) in enumerate(top):
        doc = users_by_id.get(u)
        if not doc:
            continue
        entries.append({"rank": i + 1, "xp": points, "user": user_card(doc)})

    return {
        "scope": "friends" if scope == "friends" else "global",
        "week_start": week_start,
        "week_end": week_end,
        "entries": entries,
        "me": {"rank": my_rank, "xp": my_xp, "user": user_card(current)},
    }
