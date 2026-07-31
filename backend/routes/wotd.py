"""
Word of the Day sub-app.

A curated pool of everyday high-utility English words. Every UTC day one
word is selected deterministically (day-of-year modulo pool length) so
all users see the same word globally, but it renders in each user's
`learning_language` (translation cached on-demand via deep-translator).

Endpoints (all prefixed by ``/api`` in server.py):
  GET  /wotd/today                 → today's word (auto-translated + claim/streak state)
  POST /wotd/today/claim           → award XP, tick user's WOTD streak
  GET  /wotd/history?days=7        → last N days for the pill-strip view

Storage
-------
- ``wotd_cache``   : per (day_index, lang) translated payload
- ``wotd_claims``  : per (user_id, day_key) claim row, feeds streak calc
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth_utils import get_current_user
from db import db
from routes.vocab_translate import (  # reuse the translation infra
    SUPPORTED_LANGUAGES,
    _translate_batch,
    normalize_lang,
)

router = APIRouter(prefix="/wotd", tags=["wotd"])
CurrentUser = Annotated[dict, Depends(get_current_user)]

# --------------------------------------------------------------------------- #
# Curated pool (English source of truth — 60 handpicked everyday words)
# --------------------------------------------------------------------------- #
WOTD_POOL: list[dict[str, str]] = [
    {"term": "Serendipity", "translation": "a happy accident", "example": "Meeting you here was pure serendipity."},
    {"term": "Grateful", "translation": "showing appreciation", "example": "I'm grateful for your help today."},
    {"term": "Curious", "translation": "eager to know", "example": "She's a curious learner."},
    {"term": "Vibrant", "translation": "full of life and colour", "example": "The city has a vibrant nightlife."},
    {"term": "Cozy", "translation": "warm and comfortable", "example": "The café is small but cozy."},
    {"term": "Wander", "translation": "walk aimlessly", "example": "We wandered through the old town."},
    {"term": "Whisper", "translation": "speak very softly", "example": "She whispered the secret to me."},
    {"term": "Glance", "translation": "a quick look", "example": "He gave me a glance and smiled."},
    {"term": "Genuine", "translation": "real and honest", "example": "Her smile is always genuine."},
    {"term": "Cherish", "translation": "hold dear", "example": "I cherish our friendship."},
    {"term": "Delight", "translation": "great pleasure", "example": "The children shrieked with delight."},
    {"term": "Reflect", "translation": "think carefully", "example": "Take a moment to reflect on it."},
    {"term": "Embrace", "translation": "accept willingly", "example": "Embrace new challenges."},
    {"term": "Journey", "translation": "a long trip", "example": "Life is a journey, not a destination."},
    {"term": "Radiant", "translation": "shining brightly", "example": "She wore a radiant smile."},
    {"term": "Effortless", "translation": "without difficulty", "example": "Her writing feels effortless."},
    {"term": "Ponder", "translation": "think about carefully", "example": "I need time to ponder the offer."},
    {"term": "Blossom", "translation": "flower / develop", "example": "The cherry trees blossom in spring."},
    {"term": "Diligent", "translation": "hard-working and careful", "example": "He's a diligent student."},
    {"term": "Serene", "translation": "peaceful and calm", "example": "The lake looked serene at dawn."},
    {"term": "Whimsical", "translation": "playfully unusual", "example": "She has a whimsical sense of humour."},
    {"term": "Nostalgia", "translation": "longing for the past", "example": "That song fills me with nostalgia."},
    {"term": "Resilient", "translation": "recovers quickly", "example": "Kids are surprisingly resilient."},
    {"term": "Bittersweet", "translation": "happy and sad at once", "example": "The farewell was bittersweet."},
    {"term": "Kindred", "translation": "similar in nature", "example": "We felt like kindred spirits."},
    {"term": "Luminous", "translation": "glowing softly", "example": "The moon was luminous tonight."},
    {"term": "Yearn", "translation": "long for", "example": "I yearn for the summer holidays."},
    {"term": "Radiate", "translation": "send out warmth/light", "example": "She radiates confidence."},
    {"term": "Savour", "translation": "enjoy slowly", "example": "Savour every bite of this meal."},
    {"term": "Tranquil", "translation": "peaceful", "example": "We found a tranquil beach."},
    {"term": "Wholesome", "translation": "good for well-being", "example": "That's such a wholesome story."},
    {"term": "Endeavour", "translation": "a serious attempt", "example": "Learning a language is a lifelong endeavour."},
    {"term": "Ephemeral", "translation": "lasts only briefly", "example": "Fireworks are beautiful but ephemeral."},
    {"term": "Melancholy", "translation": "gentle sadness", "example": "Rainy days give me melancholy."},
    {"term": "Vivid", "translation": "clear and lively", "example": "I have a vivid memory of that day."},
    {"term": "Radiance", "translation": "brightness / glow", "example": "Her radiance filled the room."},
    {"term": "Bewilder", "translation": "confuse deeply", "example": "The question bewildered me."},
    {"term": "Illuminate", "translation": "light up / clarify", "example": "The lamp illuminated the page."},
    {"term": "Petrichor", "translation": "smell of rain on dry earth", "example": "I love the petrichor after summer showers."},
    {"term": "Harmony", "translation": "pleasant agreement", "example": "The choir sang in perfect harmony."},
    {"term": "Wistful", "translation": "quietly longing", "example": "She looked wistful at the photograph."},
    {"term": "Zeal", "translation": "great energy or enthusiasm", "example": "He pursued the goal with zeal."},
    {"term": "Muster", "translation": "gather (courage/support)", "example": "She mustered the courage to speak up."},
    {"term": "Elated", "translation": "very happy", "example": "I was elated to hear the news."},
    {"term": "Fortitude", "translation": "quiet courage", "example": "She showed remarkable fortitude."},
    {"term": "Verdant", "translation": "lush and green", "example": "The verdant valley stretched for miles."},
    {"term": "Gleam", "translation": "faint glow", "example": "A gleam of hope appeared."},
    {"term": "Boundless", "translation": "unlimited", "example": "Her curiosity is boundless."},
    {"term": "Solace", "translation": "comfort in sadness", "example": "Music brings me solace."},
    {"term": "Effervescent", "translation": "lively and enthusiastic", "example": "He has an effervescent personality."},
    {"term": "Meander", "translation": "wind or wander", "example": "The river meanders through the fields."},
    {"term": "Kindle", "translation": "spark / start", "example": "The book kindled my love for history."},
    {"term": "Ineffable", "translation": "too great to describe", "example": "There's an ineffable beauty here."},
    {"term": "Halcyon", "translation": "calm and idyllic (times)", "example": "Those were halcyon days of childhood."},
    {"term": "Sonorous", "translation": "deep and rich (sound)", "example": "He has a sonorous voice."},
    {"term": "Aurora", "translation": "polar lights / dawn", "example": "We saw the aurora over Iceland."},
    {"term": "Ethereal", "translation": "delicate and otherworldly", "example": "Her voice was ethereal."},
    {"term": "Kinetic", "translation": "full of motion / energy", "example": "The sculpture felt kinetic and alive."},
    {"term": "Renew", "translation": "make new again", "example": "A walk in the park always renews me."},
    {"term": "Ambition", "translation": "strong desire to achieve", "example": "Her ambition drives everything she does."},
]

# XP awarded for claiming a WOTD (kept intentionally small — daily habit).
CLAIM_XP = 5

# Collections
wotd_cache_col = db["wotd_cache"]      # per (day_index, lang)
wotd_claims_col = db["wotd_claims"]    # per (user_id, day_key)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _today() -> datetime:
    return datetime.now(timezone.utc)


def _day_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def _day_index(dt: datetime) -> int:
    # Deterministic day-of-year → pool rotation (leap-safe modulo pool length).
    return (dt.timetuple().tm_yday - 1) % len(WOTD_POOL)


def _resolve_lang(current: dict, override: Optional[str]) -> str:
    return normalize_lang(override or current.get("learning_language"))


async def _ensure_localized(day_index: int, lang: str) -> dict[str, str]:
    """Return the day's word localized to `lang` (English is a pass-through)."""
    src = WOTD_POOL[day_index]
    if lang == "en" or lang not in SUPPORTED_LANGUAGES:
        return {"term": src["term"], "example": src["example"]}

    cache_id = f"{day_index}-{lang}"
    cached = await wotd_cache_col.find_one({"_id": cache_id})
    if cached and cached.get("term"):
        return {"term": cached["term"], "example": cached.get("example", src["example"])}

    # Translate on demand — batched so one HTTP round-trip covers both fields.
    try:
        results = await _translate_batch(
            lang,
            [{"id": "term", "term": src["term"], "example": ""}, {"id": "example", "term": src["example"], "example": ""}],
        )
        term_tx = results.get("term", {}).get("term") or src["term"]
        ex_tx = results.get("example", {}).get("term") or src["example"]
    except Exception:
        term_tx = src["term"]
        ex_tx = src["example"]

    await wotd_cache_col.update_one(
        {"_id": cache_id},
        {"$set": {"_id": cache_id, "term": term_tx, "example": ex_tx, "day_index": day_index, "lang": lang}},
        upsert=True,
    )
    return {"term": term_tx, "example": ex_tx}


async def _compute_streak(user_id: str) -> int:
    """Consecutive-day WOTD claim streak ending today (or yesterday)."""
    today = _today()
    streak = 0
    # Check up to 60 days back — enough for any practical streak.
    for offset in range(0, 60):
        d = today - timedelta(days=offset)
        row = await wotd_claims_col.find_one({"user_id": user_id, "day_key": _day_key(d)})
        if row:
            streak += 1
        else:
            # If the very first day (today) is missing, allow starting from
            # yesterday (so the streak survives until the user claims today).
            if offset == 0:
                continue
            break
    return streak


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@router.get("/today")
async def get_today(current: CurrentUser, lang: Optional[str] = None) -> dict[str, Any]:
    now = _today()
    idx = _day_index(now)
    day_key = _day_key(now)
    resolved = _resolve_lang(current, lang)
    localized = await _ensure_localized(idx, resolved)

    src = WOTD_POOL[idx]
    claim = await wotd_claims_col.find_one({"user_id": current["_id"], "day_key": day_key})
    streak = await _compute_streak(current["_id"])
    return {
        "day_key": day_key,
        "day_index": idx,
        "lang": resolved,
        "term_en": src["term"],
        "term": localized["term"],
        "translation": src["translation"],
        "example_en": src["example"],
        "example": localized["example"],
        "claimed": bool(claim),
        "claim_xp": CLAIM_XP,
        "streak": streak,
    }


class ClaimIn(BaseModel):
    lang: Optional[str] = None


@router.post("/today/claim")
async def claim_today(body: ClaimIn, current: CurrentUser) -> dict[str, Any]:
    now = _today()
    day_key = _day_key(now)
    idx = _day_index(now)
    # Idempotent — repeated claims on the same day are a no-op (no double XP).
    existing = await wotd_claims_col.find_one({"user_id": current["_id"], "day_key": day_key})
    awarded = 0
    if not existing:
        awarded = CLAIM_XP
        await wotd_claims_col.insert_one({
            "user_id": current["_id"],
            "day_key": day_key,
            "day_index": idx,
            "xp": CLAIM_XP,
            "created_at": now.isoformat(),
        })
        # Fold the XP into the shared vocab XP pool (lesson_prog docs).
        await db["vocab_lesson_prog"].insert_one({
            "user_id": current["_id"],
            "lesson_id": f"wotd-{day_key}",
            "status": "completed",
            "xp_awarded": CLAIM_XP,
            "completed_at": now.isoformat(),
            "completed_at_day": day_key,
        })
    streak = await _compute_streak(current["_id"])
    return {"ok": True, "awarded": awarded, "streak": streak, "day_key": day_key}


@router.get("/history")
async def get_history(current: CurrentUser, days: int = 7, lang: Optional[str] = None) -> list[dict[str, Any]]:
    """Return the previous ``days`` days (including today) with claim state.

    Useful for a 7-day pill strip in the widget: shows which days the user
    has already claimed vs missed.
    """
    days = max(1, min(days, 30))
    now = _today()
    resolved = _resolve_lang(current, lang)
    out: list[dict[str, Any]] = []
    for offset in range(days):
        d = now - timedelta(days=offset)
        idx = _day_index(d)
        src = WOTD_POOL[idx]
        localized = await _ensure_localized(idx, resolved)
        day_key = _day_key(d)
        claim = await wotd_claims_col.find_one({"user_id": current["_id"], "day_key": day_key})
        out.append({
            "day_key": day_key,
            "day_index": idx,
            "term_en": src["term"],
            "term": localized["term"],
            "translation": src["translation"],
            "claimed": bool(claim),
            "is_today": offset == 0,
        })
    return out


# Nothing to seed — the pool lives in code and rotates automatically.
async def seed_wotd_content() -> None:  # noqa: D401
    """Placeholder for symmetry with other seeders — nothing to do."""
    return None
