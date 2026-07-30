import base64
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from auth_utils import CurrentUser
from db import audio_col, comments_col, media_col, moments_col, notifications_col, rooms_col, users_col
from models import CommentCreate, MomentCreate, PollVoteBody, apply_privacy, user_card
from routes.push import send_push
from ws_manager import manager

router = APIRouter(prefix="/moments", tags=["moments"])
logger = logging.getLogger(__name__)

_PUSH_LABEL = {
    "like": "liked your moment",
    "comment": "commented on your moment",
    "reply": "replied to your comment",
}


async def _notify(
    recipient_id: str,
    actor_id: str,
    ntype: str,
    moment_id: str,
    text: str | None = None,
):
    """Store an in-app notification (like / comment / reply) and best-effort
    push it — a push failure must never block the like/comment action."""
    if recipient_id == actor_id:
        return
    await notifications_col.insert_one(
        {
            "_id": str(uuid.uuid4()),
            "user_id": recipient_id,
            "actor_id": actor_id,
            "type": ntype,
            "moment_id": moment_id,
            "text": text,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    try:
        actor = await users_col.find_one({"_id": actor_id})
        actor_name = actor.get("name") if actor else "Someone"
        message = f"{actor_name} {_PUSH_LABEL.get(ntype, 'interacted with your moment')}"
        if text:
            message += f': "{text[:80]}"'
        await send_push(
            recipients=[recipient_id],
            data={"title": actor_name, "message": message},
        )
    except Exception as e:
        logger.warning(f"Push notification failed (non-blocking): {e}")


def _card_with_presence(author: dict | None) -> dict | None:
    if not author:
        return None
    card = user_card(author)
    card["is_online"] = manager.is_online(author["_id"])
    return apply_privacy(card, author)


async def _room_card(room_id: str | None) -> dict | None:
    """Live snapshot of a shared voice room for a moment card — computed at
    read-time so it always reflects whether the room is still ongoing.
    Shape matches the voice-room list card so shared/embedded cards look
    identical everywhere: host, member preview, gradient background, topic,
    private flag, created_at for the "X min ago" line."""
    if not room_id:
        return None
    room_doc = await rooms_col.find_one({"_id": room_id})
    if not room_doc:
        return {"id": room_id, "is_live": False}
    host_card = None
    host_id = room_doc.get("host_id")
    if host_id:
        host_doc = await users_col.find_one({"_id": host_id})
        if host_doc:
            host_card = user_card(host_doc)
    member_ids = list(room_doc.get("members", {}).keys())
    preview_ids = member_ids[:4]
    preview_docs = (
        await users_col.find({"_id": {"$in": preview_ids}}).to_list(len(preview_ids))
        if preview_ids
        else []
    )
    members_preview = [user_card(u) for u in preview_docs]
    if not room_doc.get("is_live"):
        # Room has ended — keep the title/topic so the card stays meaningful.
        return {
            "id": room_id,
            "title": room_doc.get("title"),
            "topic": room_doc.get("topic"),
            "language": room_doc.get("language"),
            "background": room_doc.get("background"),
            "host": host_card,
            "members_preview": members_preview,
            "member_count": len(member_ids),
            "created_at": room_doc.get("created_at"),
            "is_live": False,
        }
    return {
        "id": room_doc["_id"],
        "title": room_doc["title"],
        "topic": room_doc.get("topic"),
        "mode": room_doc.get("mode", "chat"),
        "language": room_doc["language"],
        "languages": room_doc.get("languages") or [room_doc["language"]],
        "is_private": bool(room_doc.get("is_private")),
        "background": room_doc.get("background"),
        "member_count": len(member_ids),
        "members_preview": members_preview,
        "host": host_card,
        "created_at": room_doc.get("created_at"),
        "is_live": True,
    }


async def moment_public(doc: dict, viewer_id: str, author: dict | None = None) -> dict:
    if author is None:
        author = await users_col.find_one({"_id": doc["user_id"]})
    likes = doc.get("likes", [])
    likers = []
    if likes:
        liker_docs = await users_col.find({"_id": {"$in": likes[:6]}}).to_list(6)
        likers = [
            {
                "id": u["_id"],
                "name": u.get("name"),
                "avatar_url": u.get("avatar_url"),
                "country": u.get("country"),
            }
            for u in liker_docs
        ]
    poll_public = None
    if doc.get("poll"):
        p = doc["poll"]
        opts = []
        total = 0
        for opt in p.get("options", []):
            voters = opt.get("voters") or []
            total += len(voters)
            opts.append({"text": opt.get("text"), "votes": len(voters)})
        my_vote = None
        for i, opt in enumerate(p.get("options", [])):
            if viewer_id in (opt.get("voters") or []):
                my_vote = i
                break
        poll_public = {
            "question": p.get("question"),
            "options": opts,
            "total_votes": total,
            "my_vote": my_vote,
        }
    return {
        "id": doc["_id"],
        "author": _card_with_presence(author),
        "text": doc["text"],
        "image_url": f"/api/media/{doc['image_id']}" if doc.get("image_id") else None,
        "audio_url": f"/api/audio/{doc['audio_id']}" if doc.get("audio_id") else None,
        "audio_duration_ms": doc.get("audio_duration_ms"),
        "room": await _room_card(doc.get("room_id")),
        "tags": doc.get("tags", []) or [],
        "poll": poll_public,
        "like_count": len(likes),
        "liked_by_me": viewer_id in likes,
        "likers": likers,
        "comment_count": doc.get("comment_count", 0),
        "created_at": doc["created_at"],
    }


def comment_public(
    doc: dict,
    author: dict | None,
    viewer_id: str | None = None,
    reply_counts: dict[str, int] | None = None,
) -> dict:
    likes = doc.get("likes", []) or []
    return {
        "id": doc["_id"],
        "author": _card_with_presence(author),
        "text": doc["text"],
        "reply_to": doc.get("reply_to"),
        "reply_to_author": doc.get("reply_to_author"),
        "root_id": doc.get("root_id"),
        "like_count": len(likes),
        "liked_by_me": bool(viewer_id and viewer_id in likes),
        "reply_count": (reply_counts or {}).get(doc["_id"], 0),
        "created_at": doc["created_at"],
    }


@router.get("")
async def list_moments(current_user: CurrentUser, user_id: str | None = None):
    query = {"user_id": user_id} if user_id else {}
    docs = (
        await moments_col.find(
            query,
            {
                "user_id": 1,
                "text": 1,
                "image_id": 1,
                "audio_id": 1,
                "audio_duration_ms": 1,
                "room_id": 1,
                "tags": 1,
                "poll": 1,
                "likes": 1,
                "comment_count": 1,
                "created_at": 1,
            },
        )
        .sort("created_at", -1)
        .to_list(100)
    )
    hidden = set(current_user.get("hidden_moment_users") or []) | set(
        current_user.get("blocked_users") or []
    )
    docs = [d for d in docs if d["user_id"] not in hidden]
    author_ids = list({d["user_id"] for d in docs})
    authors = (
        await users_col.find({"_id": {"$in": author_ids}}).to_list(len(author_ids))
        if author_ids
        else []
    )
    author_map = {u["_id"]: u for u in authors}
    return [
        await moment_public(d, current_user["_id"], author_map.get(d["user_id"]))
        for d in docs
    ]


@router.get("/mine/count")
async def my_moments_count(current_user: CurrentUser):
    count = await moments_col.count_documents({"user_id": current_user["_id"]})
    return {"count": count}


@router.get("/user/{user_id}/count")
async def user_moments_count(user_id: str, current_user: CurrentUser):
    count = await moments_col.count_documents({"user_id": user_id})
    return {"count": count}


@router.post("", status_code=201)
async def create_moment(body: MomentCreate, current_user: CurrentUser):
    if current_user.get("restricted"):
        raise HTTPException(status_code=403, detail="Your account is restricted from posting.")
    if (
        not body.text.strip()
        and not body.image_base64
        and not body.audio_base64
        and not body.poll
    ):
        raise HTTPException(
            status_code=400, detail="Add some text, a photo, a voice clip or a poll"
        )
    image_id = None
    if body.image_base64:
        try:
            image_bytes = base64.b64decode(body.image_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image data")
        if len(image_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 8MB)")
        image_id = str(uuid.uuid4())
        await media_col.insert_one(
            {"_id": image_id, "data": image_bytes, "mime": body.mime}
        )
    # Voice clip attachment — stored alongside chat voice messages so the
    # existing GET /api/audio/{id} endpoint serves it.
    audio_id = None
    if body.audio_base64:
        try:
            audio_bytes = base64.b64decode(body.audio_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid audio data")
        if len(audio_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Audio too large (max 10MB)")
        audio_id = str(uuid.uuid4())
        await audio_col.insert_one(
            {"_id": audio_id, "data": audio_bytes, "mime": body.audio_mime}
        )
    # Sanitize tags: lowercase, strip #, dedupe, cap length.
    tags: list[str] = []
    if body.tags:
        seen: set[str] = set()
        for raw in body.tags:
            t = (raw or "").strip().lstrip("#").lower()
            # keep letters/numbers/underscore only — no spaces or punctuation
            t = "".join(ch for ch in t if ch.isalnum() or ch == "_")
            if 1 <= len(t) <= 30 and t not in seen:
                seen.add(t)
                tags.append(t)
    # Poll — persist question + options, each with an empty voter set. We use
    # a set of user_ids per option so a user can vote once (change mind by
    # revoting to another option).
    poll_doc = None
    if body.poll:
        opts = [
            {"text": o.text.strip(), "voters": []}
            for o in body.poll.options
            if o.text.strip()
        ]
        if len(opts) < 2:
            raise HTTPException(status_code=400, detail="Poll needs at least 2 options")
        poll_doc = {
            "question": (body.poll.question or "").strip() or None,
            "options": opts,
        }
    doc = {
        "_id": str(uuid.uuid4()),
        "user_id": current_user["_id"],
        "text": body.text.strip(),
        "image_id": image_id,
        "audio_id": audio_id,
        "audio_duration_ms": body.audio_duration_ms if audio_id else None,
        "tags": tags,
        "poll": poll_doc,
        "likes": [],
        "comment_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await moments_col.insert_one(doc)
    return await moment_public(doc, current_user["_id"])


@router.post("/{moment_id}/vote")
async def vote_on_poll(
    moment_id: str,
    body: PollVoteBody,
    current_user: CurrentUser,
):
    """Cast (or switch) a vote on a moment's poll. One vote per user — voting
    on a different option moves the vote instead of adding a second."""
    doc = await moments_col.find_one({"_id": moment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Moment not found")
    poll = doc.get("poll")
    if not poll:
        raise HTTPException(status_code=400, detail="This moment has no poll")
    options = poll.get("options", [])
    if body.option_index >= len(options):
        raise HTTPException(status_code=400, detail="Option index out of range")
    uid = current_user["_id"]
    for i, opt in enumerate(options):
        voters = list(opt.get("voters") or [])
        if uid in voters and i != body.option_index:
            voters.remove(uid)
            opt["voters"] = voters
        if i == body.option_index and uid not in voters:
            voters.append(uid)
            opt["voters"] = voters
    await moments_col.update_one(
        {"_id": moment_id}, {"$set": {"poll.options": options}}
    )
    doc["poll"]["options"] = options
    return await moment_public(doc, uid)


@router.get("/{moment_id}")
async def get_moment(moment_id: str, current_user: CurrentUser):
    doc = await moments_col.find_one({"_id": moment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Moment not found")
    moment = await moment_public(doc, current_user["_id"])
    comment_docs = (
        await comments_col.find({"moment_id": moment_id}).sort("created_at", 1).to_list(500)
    )
    author_ids = list({c["user_id"] for c in comment_docs})
    authors = (
        await users_col.find({"_id": {"$in": author_ids}}).to_list(len(author_ids))
        if author_ids
        else []
    )
    author_map = {u["_id"]: u for u in authors}
    # Count how many replies each comment has anywhere in its subtree ─ we
    # roll up direct children AND grandchildren using root_id so a "N replies"
    # counter on the top-level card matches Twitter behaviour.
    reply_counts: dict[str, int] = {}
    for c in comment_docs:
        parent_id = c.get("reply_to")
        if parent_id:
            reply_counts[parent_id] = reply_counts.get(parent_id, 0) + 1
        root_id = c.get("root_id")
        if root_id and root_id != parent_id:
            reply_counts[root_id] = reply_counts.get(root_id, 0) + 1
    viewer_id = current_user["_id"]
    moment["comments"] = [
        comment_public(c, author_map.get(c["user_id"]), viewer_id, reply_counts)
        for c in comment_docs
    ]
    return moment


@router.get("/{moment_id}/likes")
async def list_likers(moment_id: str, current_user: CurrentUser):
    doc = await moments_col.find_one({"_id": moment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Moment not found")
    likes = doc.get("likes", [])
    if not likes:
        return []
    users = await users_col.find({"_id": {"$in": likes}}).to_list(500)
    order = {uid: i for i, uid in enumerate(likes)}
    users.sort(key=lambda u: order.get(u["_id"], 0))
    return [_card_with_presence(u) for u in users]


@router.post("/{moment_id}/like")
async def toggle_like(moment_id: str, current_user: CurrentUser):
    doc = await moments_col.find_one({"_id": moment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Moment not found")
    liked = current_user["_id"] in doc.get("likes", [])
    op = "$pull" if liked else "$addToSet"
    await moments_col.update_one({"_id": moment_id}, {op: {"likes": current_user["_id"]}})
    if not liked:
        await _notify(doc["user_id"], current_user["_id"], "like", moment_id)
    return {"liked": not liked, "like_count": len(doc.get("likes", [])) + (-1 if liked else 1)}


@router.post("/{moment_id}/comments", status_code=201)
async def add_comment(moment_id: str, body: CommentCreate, current_user: CurrentUser):
    doc = await moments_col.find_one({"_id": moment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Moment not found")
    comment = {
        "_id": str(uuid.uuid4()),
        "moment_id": moment_id,
        "user_id": current_user["_id"],
        "text": body.text,
        "likes": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    parent = None
    if body.reply_to:
        parent = await comments_col.find_one(
            {"_id": body.reply_to, "moment_id": moment_id}
        )
        if not parent:
            raise HTTPException(status_code=404, detail="Comment to reply to not found")
        parent_author = await users_col.find_one({"_id": parent["user_id"]})
        comment["reply_to"] = body.reply_to
        comment["reply_to_author"] = parent_author.get("name") if parent_author else None
        # Root = top-level ancestor. If parent is itself a reply, inherit its
        # root_id; otherwise the parent IS the root.
        comment["root_id"] = parent.get("root_id") or parent["_id"]
    await comments_col.insert_one(comment)
    await moments_col.update_one({"_id": moment_id}, {"$inc": {"comment_count": 1}})
    if parent:
        await _notify(
            parent["user_id"], current_user["_id"], "reply", moment_id, body.text
        )
        if doc["user_id"] != parent["user_id"]:
            await _notify(
                doc["user_id"], current_user["_id"], "comment", moment_id, body.text
            )
    else:
        await _notify(
            doc["user_id"], current_user["_id"], "comment", moment_id, body.text
        )
    return comment_public(comment, current_user, current_user["_id"], {})


@router.post("/{moment_id}/comments/{comment_id}/like")
async def toggle_comment_like(
    moment_id: str, comment_id: str, current_user: CurrentUser
):
    doc = await comments_col.find_one({"_id": comment_id, "moment_id": moment_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Comment not found")
    likes = doc.get("likes", []) or []
    liked = current_user["_id"] in likes
    op = "$pull" if liked else "$addToSet"
    await comments_col.update_one(
        {"_id": comment_id}, {op: {"likes": current_user["_id"]}}
    )
    new_count = len(likes) + (-1 if liked else 1)
    if not liked and doc["user_id"] != current_user["_id"]:
        await _notify(
            doc["user_id"], current_user["_id"], "like", moment_id, doc.get("text")
        )
    return {"liked": not liked, "like_count": new_count}
