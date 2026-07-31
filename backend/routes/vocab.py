"""
Vocab sub-app backend.

Everything a user needs for the 100%-designed Vocab redesign lives here:
- Static-ish content library (topics, words, lessons) seeded on startup.
- Per-user progress (word mastery, lesson completion, streak, XP, level).
- Bookmarks (tutors + words).
- Bookings (private tutor lessons).
- Challenges with computed per-user progress.

Everything is 100% idempotent so restarts are safe.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth_utils import get_current_user
from db import db

router = APIRouter(prefix="/vocab", tags=["vocab"])

# --------------------------------------------------------------------------- #
# Collections
# --------------------------------------------------------------------------- #
vocab_topics_col = db["vocab_topics"]
vocab_words_col = db["vocab_words"]
vocab_lessons_col = db["vocab_lessons"]
vocab_progress_col = db["vocab_progress"]          # per (user, word)
vocab_lesson_prog_col = db["vocab_lesson_prog"]    # per (user, lesson)
vocab_bookmarks_col = db["vocab_bookmarks"]        # per (user, target_type, target_id)
vocab_bookings_col = db["vocab_bookings"]          # per (user, tutor, slot)
vocab_challenges_col = db["vocab_challenges"]

CurrentUser = Annotated[dict, Depends(get_current_user)]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# --------------------------------------------------------------------------- #
# Seed content (source of truth lives in vocab_content.py)
# --------------------------------------------------------------------------- #
from routes.vocab_content import (  # noqa: E402
    CHALLENGES_SEED,
    LESSONS_SEED,
    TOPICS_SEED,
    WORDS_SEED,
)
from routes.vocab_translate import (  # noqa: E402
    SUPPORTED_LANGUAGES,
    ensure_topic_translations,
    localize_word,
    normalize_lang,
)


def _user_lang(current: dict, override: str | None) -> str:
    """Resolve the effective learning language: explicit ``lang`` param wins,
    otherwise fall back to the user's profile, otherwise English."""
    return normalize_lang(override or current.get("learning_language"))


def _lesson_steps(lesson: dict[str, Any], words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Assemble a linear step list for the lesson player from topic words.

    Structure: 8 vocab cards, with a multiple-choice quiz inserted after every
    4th card (or fewer if there aren't enough words), followed by a `done`
    step. Quiz distractors are drawn from the same topic to make the choices
    plausible.
    """
    lesson_words = words[:8] if words else []
    steps: list[dict[str, Any]] = []
    quiz_pool = lesson_words[:] or []

    def push_quiz(target: dict[str, Any]) -> None:
        pool = [w for w in quiz_pool if w["id"] != target["id"]]
        distractors = [w["term"] for w in pool[:3]]
        options = list({target["term"], *distractors})
        while len(options) < 4 and pool:
            candidate = pool.pop(0)["term"]
            if candidate not in options:
                options.append(candidate)
        # Deterministic-but-varied order: rotate so the answer is not always first.
        idx = (sum(ord(c) for c in target["id"]) % max(1, len(options)))
        options = options[idx:] + options[:idx]
        steps.append({
            "kind": "quiz",
            "prompt": f"Which word means: \u201c{target['translation']}\u201d?",
            "options": options,
            "answer": target["term"],
            "word_id": target["id"],
        })

    for i, w in enumerate(lesson_words):
        steps.append({
            "kind": "vocab",
            "term": w["term"],
            "translation": w["translation"],
            "example": w.get("example", ""),
            "word_id": w["id"],
        })
        # Quiz every 4th card, using that card as the answer.
        if (i + 1) % 4 == 0:
            push_quiz(w)

    # Guarantee at least one quiz at the end if none has been added yet.
    if lesson_words and not any(s["kind"] == "quiz" for s in steps):
        push_quiz(lesson_words[0])

    steps.append({"kind": "done", "message": f"You earned {lesson['xp_reward']} XP!"})
    return steps


async def seed_vocab_content() -> None:
    """Idempotent seed of topics, words, lessons, challenges."""
    # Topics
    for t in TOPICS_SEED:
        await vocab_topics_col.update_one(
            {"_id": t["id"]},
            {"$set": {**t, "_id": t["id"]}},
            upsert=True,
        )
    # Words
    for topic_id, words in WORDS_SEED.items():
        for i, w in enumerate(words):
            wid = f"{topic_id}-{i}"
            await vocab_words_col.update_one(
                {"_id": wid},
                {"$set": {**w, "_id": wid, "id": wid, "topic_id": topic_id}},
                upsert=True,
            )
    # Lessons
    for l in LESSONS_SEED:
        await vocab_lessons_col.update_one(
            {"_id": l["id"]},
            {"$set": {**l, "_id": l["id"]}},
            upsert=True,
        )
    # Challenges
    for c in CHALLENGES_SEED:
        await vocab_challenges_col.update_one(
            {"_id": c["id"]},
            {"$set": {**c, "_id": c["id"]}},
            upsert=True,
        )


# --------------------------------------------------------------------------- #
# Stats helpers
# --------------------------------------------------------------------------- #
def _level_for_xp(xp: int) -> dict[str, Any]:
    # Curve: 100 XP per level.
    level = 1 + xp // 100
    xp_in_level = xp % 100
    xp_to_next = 100 - xp_in_level
    return {"level": level, "xp": xp, "xp_in_level": xp_in_level, "xp_to_next": xp_to_next, "progress": xp_in_level / 100.0}


async def _compute_stats(user_id: str) -> dict[str, Any]:
    # Words learned = progress rows with status='known'
    words_learned = await vocab_progress_col.count_documents({"user_id": user_id, "status": "known"})
    words_practicing = await vocab_progress_col.count_documents({"user_id": user_id, "status": "learning"})
    lessons_completed = await vocab_lesson_prog_col.count_documents({"user_id": user_id, "status": "completed"})
    xp_docs = await vocab_lesson_prog_col.find({"user_id": user_id, "status": "completed"}).to_list(500)
    xp = sum(d.get("xp_awarded", 0) for d in xp_docs) + words_learned * 2  # +2 XP per learned word
    lvl = _level_for_xp(xp)

    # Streak — count consecutive days ending today with any progress activity
    streak = 0
    today = datetime.now(timezone.utc).date()
    for i in range(0, 60):
        d = today - timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        has_activity = await vocab_progress_col.count_documents({"user_id": user_id, "date_key": key}, limit=1) > 0
        if not has_activity:
            has_activity = await vocab_lesson_prog_col.count_documents({"user_id": user_id, "completed_at_day": key}, limit=1) > 0
        if has_activity:
            streak += 1
        else:
            if i == 0:
                # No activity today — streak is 0 unless we allow grace; keep at 0.
                break
            break
    return {
        "words_learned": words_learned,
        "words_practicing": words_practicing,
        "lessons_completed": lessons_completed,
        "streak": streak,
        **lvl,
    }


# --------------------------------------------------------------------------- #
# Request models
# --------------------------------------------------------------------------- #
class WordProgressIn(BaseModel):
    word_id: str
    status: Literal["new", "learning", "known"]


class LessonCompleteIn(BaseModel):
    step_count: Optional[int] = None
    correct_count: Optional[int] = None


class BookmarkToggleIn(BaseModel):
    target_type: Literal["tutor", "word", "lesson"]
    target_id: str


class BookingIn(BaseModel):
    tutor_id: str
    slot_iso: str = Field(..., description="ISO-8601 datetime for the booked slot")
    duration_min: int = 60
    note: Optional[str] = None


# --------------------------------------------------------------------------- #
# Routes — content
# --------------------------------------------------------------------------- #
@router.get("/topics")
async def list_topics(current: CurrentUser) -> list[dict[str, Any]]:
    docs = await vocab_topics_col.find({}).to_list(200)
    # Attach word count + user's known count per topic.
    out = []
    for t in docs:
        wcount = await vocab_words_col.count_documents({"topic_id": t["_id"]})
        known = await vocab_progress_col.count_documents({"user_id": current["_id"], "topic_id": t["_id"], "status": "known"})
        out.append({
            "id": t["_id"],
            "name": t["name"],
            "subtitle": t["subtitle"],
            "icon": t["icon"],
            "color": t.get("color", "mint"),
            "word_count": wcount,
            "words_learned": known,
        })
    return out


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str, current: CurrentUser) -> dict[str, Any]:
    t = await vocab_topics_col.find_one({"_id": topic_id})
    if not t:
        raise HTTPException(404, "Topic not found")
    wcount = await vocab_words_col.count_documents({"topic_id": topic_id})
    known = await vocab_progress_col.count_documents({"user_id": current["_id"], "topic_id": topic_id, "status": "known"})
    return {
        "id": t["_id"],
        "name": t["name"],
        "subtitle": t["subtitle"],
        "icon": t["icon"],
        "color": t.get("color", "mint"),
        "word_count": wcount,
        "words_learned": known,
    }


@router.get("/topics/{topic_id}/words")
async def list_words(
    topic_id: str, current: CurrentUser, lang: Optional[str] = None
) -> list[dict[str, Any]]:
    effective_lang = _user_lang(current, lang)
    if effective_lang != "en":
        await ensure_topic_translations(topic_id, effective_lang)
    docs = await vocab_words_col.find({"topic_id": topic_id}).to_list(500)
    prog = {
        p["word_id"]: p
        for p in await vocab_progress_col.find(
            {"user_id": current["_id"], "topic_id": topic_id}
        ).to_list(2000)
    }
    out = []
    for d in docs:
        loc = localize_word(d, effective_lang)
        out.append({
            "id": d["_id"],
            "term": loc["term"],
            "translation": d["translation"],
            "example": loc["example"],
            "source_term": loc["source_term"],
            "source_example": loc["source_example"],
            "topic_id": d["topic_id"],
            "lang": loc["lang"],
            "status": (prog.get(d["_id"]) or {}).get("status", "new"),
        })
    return out


@router.get("/lessons")
async def list_lessons(topic_id: Optional[str] = None, level: Optional[str] = None, current: CurrentUser = None) -> list[dict[str, Any]]:
    q: dict[str, Any] = {}
    if topic_id:
        q["topic_id"] = topic_id
    if level:
        q["level"] = level
    docs = await vocab_lessons_col.find(q).sort([("minutes", 1)]).to_list(200)
    completed = {p["lesson_id"] for p in await vocab_lesson_prog_col.find({"user_id": current["_id"], "status": "completed"}).to_list(500)}
    return [{
        "id": d["_id"],
        "title": d["title"],
        "description": d["description"],
        "topic_id": d["topic_id"],
        "level": d["level"],
        "minutes": d["minutes"],
        "xp_reward": d.get("xp_reward", 20),
        "completed": d["_id"] in completed,
    } for d in docs]


@router.get("/lessons/{lesson_id}")
async def get_lesson(
    lesson_id: str, current: CurrentUser, lang: Optional[str] = None
) -> dict[str, Any]:
    l = await vocab_lessons_col.find_one({"_id": lesson_id})
    if not l:
        raise HTTPException(404, "Lesson not found")
    effective_lang = _user_lang(current, lang)
    if effective_lang != "en":
        await ensure_topic_translations(l["topic_id"], effective_lang)
    words_docs = await vocab_words_col.find({"topic_id": l["topic_id"]}).to_list(20)
    localized_words = [localize_word(w, effective_lang) for w in words_docs]
    steps = _lesson_steps(l, localized_words)
    prog = await vocab_lesson_prog_col.find_one(
        {"user_id": current["_id"], "lesson_id": lesson_id}
    )
    return {
        "id": l["_id"],
        "title": l["title"],
        "description": l["description"],
        "topic_id": l["topic_id"],
        "level": l["level"],
        "minutes": l["minutes"],
        "xp_reward": l.get("xp_reward", 20),
        "lang": effective_lang,
        "steps": steps,
        "progress": {
            "status": (prog or {}).get("status", "new"),
            "current_step": (prog or {}).get("current_step", 0),
            "xp_awarded": (prog or {}).get("xp_awarded", 0),
        },
    }


@router.get("/languages")
async def list_supported_languages(current: CurrentUser) -> dict[str, Any]:
    """Return the languages Vocab has full content for, plus the caller's
    currently-selected `learning_language` (canonical ISO code)."""
    return {
        "supported": [
            {"code": code, "name": name}
            for code, name in SUPPORTED_LANGUAGES.items()
        ],
        "current": _user_lang(current, None),
    }


class SetLanguageIn(BaseModel):
    lang: str


@router.post("/me/language")
async def set_learning_language(
    body: SetLanguageIn, current: CurrentUser
) -> dict[str, Any]:
    """Update the caller's `learning_language` field (used across the app as
    the target language they're actively studying)."""
    code = normalize_lang(body.lang)
    if code not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, "Unsupported language")
    # Store the ISO code — matches what other endpoints already read.
    await db["users"].update_one(
        {"_id": current["_id"]}, {"$set": {"learning_language": code}}
    )
    return {"ok": True, "learning_language": code}


# --------------------------------------------------------------------------- #
# Routes — progress
# --------------------------------------------------------------------------- #
@router.post("/progress/word")
async def set_word_progress(body: WordProgressIn, current: CurrentUser) -> dict[str, Any]:
    word = await vocab_words_col.find_one({"_id": body.word_id})
    if not word:
        raise HTTPException(404, "Word not found")
    await vocab_progress_col.update_one(
        {"user_id": current["_id"], "word_id": body.word_id},
        {"$set": {
            "user_id": current["_id"],
            "word_id": body.word_id,
            "topic_id": word["topic_id"],
            "status": body.status,
            "updated_at": _now(),
            "date_key": _today_key(),
        }},
        upsert=True,
    )
    return {"ok": True, "stats": await _compute_stats(current["_id"])}


@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(lesson_id: str, body: LessonCompleteIn, current: CurrentUser) -> dict[str, Any]:
    l = await vocab_lessons_col.find_one({"_id": lesson_id})
    if not l:
        raise HTTPException(404, "Lesson not found")
    existing = await vocab_lesson_prog_col.find_one({"user_id": current["_id"], "lesson_id": lesson_id})
    # Award XP only once (first completion).
    xp = 0 if (existing and existing.get("status") == "completed") else l.get("xp_reward", 20)
    await vocab_lesson_prog_col.update_one(
        {"user_id": current["_id"], "lesson_id": lesson_id},
        {"$set": {
            "user_id": current["_id"],
            "lesson_id": lesson_id,
            "status": "completed",
            "xp_awarded": (existing or {}).get("xp_awarded", 0) + xp,
            "correct_count": body.correct_count,
            "step_count": body.step_count,
            "completed_at": _now(),
            "completed_at_day": _today_key(),
        }},
        upsert=True,
    )
    return {"ok": True, "xp_awarded": xp, "stats": await _compute_stats(current["_id"])}


# --------------------------------------------------------------------------- #
# Routes — me
# --------------------------------------------------------------------------- #
@router.get("/me/stats")
async def me_stats(current: CurrentUser) -> dict[str, Any]:
    stats = await _compute_stats(current["_id"])
    stats["placement_level"] = current.get("vocab_level")
    return stats


@router.get("/me/continue")
async def me_continue(current: CurrentUser) -> dict[str, Any]:
    """Best 'continue' suggestion: most recently interacted lesson or a starter."""
    prog = await vocab_lesson_prog_col.find({"user_id": current["_id"], "status": {"$ne": "completed"}}).sort([("_id", -1)]).to_list(5)
    lesson: Optional[dict[str, Any]] = None
    if prog:
        lesson = await vocab_lessons_col.find_one({"_id": prog[0]["lesson_id"]})
    if not lesson:
        # First uncompleted lesson otherwise first ever
        completed_ids = [p["lesson_id"] for p in await vocab_lesson_prog_col.find({"user_id": current["_id"], "status": "completed"}).to_list(500)]
        lesson = await vocab_lessons_col.find_one({"_id": {"$nin": completed_ids}}) or await vocab_lessons_col.find_one({})
    if not lesson:
        raise HTTPException(404, "No lessons available")
    topic = await vocab_topics_col.find_one({"_id": lesson["topic_id"]})
    lp = await vocab_lesson_prog_col.find_one({"user_id": current["_id"], "lesson_id": lesson["_id"]}) or {}
    # Compute expected step count from real content (8 vocab max + up to 2 quizzes + done).
    total_words = await vocab_words_col.count_documents({"topic_id": lesson["topic_id"]})
    vocab_steps = min(8, total_words)
    quiz_steps = 1 + (1 if vocab_steps >= 8 else 0)
    total_steps = max(1, vocab_steps + quiz_steps + 1)
    progress = 0.0
    if lp:
        progress = min(1.0, (lp.get("current_step", 0) or 0) / total_steps)
    return {
        "id": lesson["_id"],
        "title": lesson["title"],
        "topic_id": lesson["topic_id"],
        "topic_name": (topic or {}).get("name", ""),
        "level": lesson["level"],
        "minutes": lesson["minutes"],
        "progress": progress,
        "tag": "In progress" if lp else "Recommended",
    }


@router.get("/me/bookmarks")
async def list_bookmarks(current: CurrentUser) -> dict[str, list[dict[str, Any]]]:
    docs = await vocab_bookmarks_col.find({"user_id": current["_id"]}).to_list(500)
    return {
        "tutors": [d for d in docs if d["target_type"] == "tutor"],
        "words": [d for d in docs if d["target_type"] == "word"],
        "lessons": [d for d in docs if d["target_type"] == "lesson"],
    }


@router.post("/bookmarks/toggle")
async def toggle_bookmark(body: BookmarkToggleIn, current: CurrentUser) -> dict[str, Any]:
    existing = await vocab_bookmarks_col.find_one({
        "user_id": current["_id"], "target_type": body.target_type, "target_id": body.target_id,
    })
    if existing:
        await vocab_bookmarks_col.delete_one({"_id": existing["_id"]})
        return {"bookmarked": False}
    await vocab_bookmarks_col.insert_one({
        "_id": str(uuid.uuid4()),
        "user_id": current["_id"],
        "target_type": body.target_type,
        "target_id": body.target_id,
        "created_at": _now(),
    })
    return {"bookmarked": True}


@router.get("/bookmarks/status/{target_type}/{target_id}")
async def bookmark_status(target_type: str, target_id: str, current: CurrentUser) -> dict[str, bool]:
    hit = await vocab_bookmarks_col.find_one({
        "user_id": current["_id"], "target_type": target_type, "target_id": target_id,
    })
    return {"bookmarked": bool(hit)}


# --------------------------------------------------------------------------- #
# Routes — bookings
# --------------------------------------------------------------------------- #
@router.post("/bookings")
async def create_booking(body: BookingIn, current: CurrentUser) -> dict[str, Any]:
    booking = {
        "_id": str(uuid.uuid4()),
        "user_id": current["_id"],
        "tutor_id": body.tutor_id,
        "slot_iso": body.slot_iso,
        "duration_min": body.duration_min,
        "note": body.note,
        "status": "confirmed",
        "created_at": _now(),
    }
    await vocab_bookings_col.insert_one(booking)
    # Try to enrich with tutor snapshot for the response
    tutor = await db["pro_profiles"].find_one({"_id": body.tutor_id}) or await db["pro_profiles"].find_one({"user_id": body.tutor_id})
    if tutor:
        booking["tutor_name"] = tutor.get("name") or tutor.get("display_name")
        booking["tutor_avatar_url"] = tutor.get("avatar_url")
    return booking


@router.get("/me/bookings")
async def my_bookings(current: CurrentUser) -> list[dict[str, Any]]:
    docs = await vocab_bookings_col.find({"user_id": current["_id"]}).sort([("slot_iso", 1)]).to_list(200)
    # Enrich
    tutor_ids = list({d["tutor_id"] for d in docs})
    tutors_map: dict[str, dict[str, Any]] = {}
    if tutor_ids:
        async for t in db["pro_profiles"].find({"_id": {"$in": tutor_ids}}):
            tutors_map[t["_id"]] = t
    out = []
    for d in docs:
        t = tutors_map.get(d["tutor_id"], {})
        out.append({
            **d,
            "tutor_name": t.get("name") or t.get("display_name") or "Tutor",
            "tutor_avatar_url": t.get("avatar_url"),
        })
    return out


@router.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: str, current: CurrentUser) -> dict[str, bool]:
    res = await vocab_bookings_col.delete_one({"_id": booking_id, "user_id": current["_id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Booking not found")
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Routes — placement test
# --------------------------------------------------------------------------- #
# Curated 10-question bank, tiered easy → hard. Answers stay server-side; the
# client only ever sees prompt + options.
PLACEMENT_BANK: list[dict[str, Any]] = [
    # easy
    {"id": "pl-e1", "tier": "easy", "prompt": "Which word means “happy”?", "options": ["Glad", "Angry", "Tired", "Hungry"], "answer": "Glad"},
    {"id": "pl-e2", "tier": "easy", "prompt": "Pick the OPPOSITE of “big”.", "options": ["Small", "Tall", "Wide", "Heavy"], "answer": "Small"},
    {"id": "pl-e3", "tier": "easy", "prompt": "“She ___ to school every day.”", "options": ["goes", "go", "going", "gone"], "answer": "goes"},
    {"id": "pl-e4", "tier": "easy", "prompt": "Which word is a colour?", "options": ["Purple", "Table", "Run", "Quick"], "answer": "Purple"},
    # medium
    {"id": "pl-m1", "tier": "medium", "prompt": "Which word means “to make something better”?", "options": ["Improve", "Ignore", "Impress", "Import"], "answer": "Improve"},
    {"id": "pl-m2", "tier": "medium", "prompt": "“I have lived here ___ 2019.”", "options": ["since", "for", "from", "at"], "answer": "since"},
    {"id": "pl-m3", "tier": "medium", "prompt": "A “reliable” person is someone you can…", "options": ["trust", "avoid", "forget", "confuse"], "answer": "trust"},
    # hard
    {"id": "pl-h1", "tier": "hard", "prompt": "Which word means “lasting for a very short time”?", "options": ["Ephemeral", "Eternal", "Endemic", "Emphatic"], "answer": "Ephemeral"},
    {"id": "pl-h2", "tier": "hard", "prompt": "“The committee ___ the proposal after a heated debate.”", "options": ["rejected", "rejoiced", "rebounded", "retained by"], "answer": "rejected"},
    {"id": "pl-h3", "tier": "hard", "prompt": "Pick the closest synonym of “meticulous”.", "options": ["Thorough", "Careless", "Rapid", "Generous"], "answer": "Thorough"},
]
PLACEMENT_MAP = {q["id"]: q for q in PLACEMENT_BANK}
vocab_placements_col = db["vocab_placements"]


class PlacementSubmitIn(BaseModel):
    attempt_id: str
    answers: dict[str, str]  # question_id → chosen option


def _placement_level(correct_by_tier: dict[str, int], total_correct: int) -> str:
    if total_correct >= 8 and correct_by_tier.get("hard", 0) >= 2:
        return "Advanced"
    if total_correct >= 5:
        return "Intermediate"
    return "Beginner"


@router.get("/placement/questions")
async def placement_questions(current: CurrentUser) -> dict[str, Any]:
    """Start a placement attempt: 10 questions, easy → hard."""
    attempt_id = str(uuid.uuid4())
    await vocab_placements_col.insert_one({
        "_id": attempt_id,
        "user_id": current["_id"],
        "question_ids": [q["id"] for q in PLACEMENT_BANK],
        "status": "open",
        "created_at": _now(),
    })
    return {
        "attempt_id": attempt_id,
        "questions": [
            {"id": q["id"], "tier": q["tier"], "prompt": q["prompt"], "options": q["options"]}
            for q in PLACEMENT_BANK
        ],
    }


@router.post("/placement/submit")
async def placement_submit(body: PlacementSubmitIn, current: CurrentUser) -> dict[str, Any]:
    attempt = await vocab_placements_col.find_one({"_id": body.attempt_id, "user_id": current["_id"]})
    if not attempt:
        raise HTTPException(404, "Attempt not found")
    correct_by_tier: dict[str, int] = {"easy": 0, "medium": 0, "hard": 0}
    total_correct = 0
    for qid in attempt["question_ids"]:
        q = PLACEMENT_MAP.get(qid)
        if q and body.answers.get(qid) == q["answer"]:
            correct_by_tier[q["tier"]] += 1
            total_correct += 1
    level = _placement_level(correct_by_tier, total_correct)
    await vocab_placements_col.update_one(
        {"_id": body.attempt_id},
        {"$set": {"status": "completed", "score": total_correct, "level": level, "completed_at": _now()}},
    )
    # Auto-apply the result — Vocab Hub reads users.vocab_level as its default level.
    await db["users"].update_one({"_id": current["_id"]}, {"$set": {"vocab_level": level}})
    return {
        "score": total_correct,
        "total": len(attempt["question_ids"]),
        "level": level,
        "correct_by_tier": correct_by_tier,
    }


# --------------------------------------------------------------------------- #
# Routes — challenges
# --------------------------------------------------------------------------- #
@router.get("/challenges")
async def list_challenges(current: CurrentUser) -> list[dict[str, Any]]:
    docs = await vocab_challenges_col.find({}).to_list(200)
    stats = await _compute_stats(current["_id"])
    out = []
    for c in docs:
        goal = c.get("goal_type")
        current_val = 0
        if goal == "words_learned":
            current_val = stats["words_learned"]
        elif goal == "lessons_completed":
            current_val = stats["lessons_completed"]
        elif goal == "streak":
            current_val = stats["streak"]
        target = c.get("target", 1)
        out.append({
            "id": c["_id"],
            "title": c["title"],
            "days_left": c.get("days_left", 3),
            "icon": c.get("icon", "reader-outline"),
            "goal_type": goal,
            "target": target,
            "current": current_val,
            "progress": min(1.0, current_val / max(1, target)),
            "completed": current_val >= target,
        })
    return out
