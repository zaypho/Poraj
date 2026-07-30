import base64
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth_utils import get_current_user
from config_utils import DEFAULTS, get_app_config
from db import (
    config_col,
    conversations_col,
    market_config_col,
    messages_col,
    moments_col,
    notifications_col,
    pro_profiles_col,
    pro_sessions_col,
    rooms_col,
    users_col,
)
from routes.market import CATALOG
from routes.pro import profile_public, session_public
from routes.push import send_push
from ws_manager import manager

router = APIRouter(prefix="/admin", tags=["admin"])

# /app/backend/routes/admin.py -> parents: routes, backend, app (root)
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_FRONTEND_DIR = _REPO_ROOT / "frontend"

# Registry of build-time integration config files that can be managed from
# the Admin Console instead of being handed to the dev agent in chat. Add
# new entries here whenever a future integration needs an uploaded file
# (e.g. an iOS `GoogleService-Info.plist`).
INTEGRATION_FILES: dict[str, dict] = {
    "google_services_json": {
        "label": "google-services.json",
        "description": "Firebase config for Android push notifications (FCM). Re-upload here any time the Firebase project changes — no code changes needed.",
        "path": _FRONTEND_DIR / "google-services.json",
    },
}


async def require_admin(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


AdminUser = Annotated[dict, Depends(require_admin)]


def admin_user_row(doc: dict) -> dict:
    return {
        "id": doc["_id"],
        "name": doc.get("name"),
        "email": doc.get("email"),
        "avatar_url": doc.get("avatar_url"),
        "country": doc.get("country"),
        "gender": doc.get("gender"),
        "native_language": doc.get("native_language"),
        "coins": doc.get("coins", 0),
        "is_vip": bool(doc.get("is_vip")),
        "vip_tier": doc.get("vip_tier"),
        "is_admin": bool(doc.get("is_admin")),
        "banned": bool(doc.get("banned")),
        "restricted": bool(doc.get("restricted")),
        "is_online": manager.is_online(doc["_id"]),
        "created_at": doc.get("created_at"),
    }


@router.get("/stats")
async def stats(admin: AdminUser):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_users = await users_col.count_documents({})
    vip_users = await users_col.count_documents({"is_vip": True})
    banned = await users_col.count_documents({"banned": True})
    new_today = await users_col.count_documents({"created_at": {"$gte": today}})
    total_moments = await moments_col.count_documents({})
    total_messages = await messages_col.count_documents({})
    total_convs = await conversations_col.count_documents({})
    live_rooms = await rooms_col.count_documents({"is_live": True})
    coins_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$coins"}}}]
    coins_agg = await users_col.aggregate(coins_pipeline).to_list(1)
    return {
        "total_users": total_users,
        "vip_users": vip_users,
        "banned_users": banned,
        "new_users_today": new_today,
        "online_now": len(manager.online_user_ids()),
        "total_moments": total_moments,
        "total_messages": total_messages,
        "total_conversations": total_convs,
        "live_rooms": live_rooms,
        "coins_in_circulation": coins_agg[0]["total"] if coins_agg else 0,
    }


@router.get("/users")
async def list_users(admin: AdminUser, search: str | None = None):
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    docs = (
        await users_col.find(query, {"password_hash": 0})
        .sort("created_at", -1)
        .to_list(300)
    )
    return [admin_user_row(d) for d in docs]


@router.post("/users/{user_id}/ban")
async def toggle_ban(user_id: str, admin: AdminUser):
    doc = await users_col.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    if doc.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot ban an admin")
    banned = not doc.get("banned", False)
    await users_col.update_one({"_id": user_id}, {"$set": {"banned": banned}})
    return {"banned": banned}


@router.post("/users/{user_id}/restrict")
async def toggle_restrict(user_id: str, admin: AdminUser):
    doc = await users_col.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    restricted = not doc.get("restricted", False)
    await users_col.update_one({"_id": user_id}, {"$set": {"restricted": restricted}})
    return {"restricted": restricted}


class CoinsUpdate(BaseModel):
    coins: int


@router.put("/users/{user_id}/coins")
async def set_coins(user_id: str, body: CoinsUpdate, admin: AdminUser):
    if body.coins < 0:
        raise HTTPException(status_code=400, detail="Coins must be >= 0")
    res = await users_col.update_one({"_id": user_id}, {"$set": {"coins": body.coins}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"coins": body.coins}


class VipUpdate(BaseModel):
    is_vip: bool
    tier: str | None = None  # weekly | monthly | lifetime


@router.put("/users/{user_id}/vip")
async def set_vip(user_id: str, body: VipUpdate, admin: AdminUser):
    updates: dict = {"is_vip": body.is_vip}
    if body.is_vip:
        updates["vip_tier"] = body.tier or "lifetime"
        updates["vip_expires_at"] = None
    else:
        updates["vip_tier"] = None
        updates["vip_expires_at"] = None
    res = await users_col.update_one({"_id": user_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"is_vip": body.is_vip, "vip_tier": updates["vip_tier"]}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: AdminUser):
    doc = await users_col.find_one({"_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    if doc.get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete an admin")
    await users_col.delete_one({"_id": user_id})
    await moments_col.delete_many({"user_id": user_id})
    return {"ok": True}


@router.get("/signups")
async def signup_series(admin: AdminUser, days: int = 7):
    """Daily signup counts for the last N days — powers the Overview chart."""
    days = max(1, min(days, 30))
    today = datetime.now(timezone.utc).date()
    out = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)
        count = await users_col.count_documents(
            {"created_at": {"$gte": day.isoformat(), "$lt": next_day.isoformat()}}
        )
        out.append({"date": day.isoformat(), "count": count})
    return out


@router.get("/rooms")
async def list_rooms(admin: AdminUser):
    """All voice rooms, newest first — live ones on top."""
    docs = (
        await rooms_col.find({})
        .sort([("is_live", -1), ("created_at", -1)])
        .to_list(100)
    )
    host_ids = list({d["host_id"] for d in docs})
    hosts = (
        await users_col.find({"_id": {"$in": host_ids}}, {"name": 1, "email": 1}).to_list(
            len(host_ids)
        )
        if host_ids
        else []
    )
    host_map = {h["_id"]: h for h in hosts}
    out = []
    for d in docs:
        h = host_map.get(d["host_id"])
        out.append(
            {
                "id": d["_id"],
                "title": d["title"],
                "language": d.get("language"),
                "topic": d.get("topic"),
                "is_live": bool(d.get("is_live")),
                "is_private": bool(d.get("is_private")),
                "member_count": len(d.get("members", {})),
                "host_name": h.get("name") if h else "Unknown",
                "host_email": h.get("email") if h else None,
                "created_at": d.get("created_at"),
            }
        )
    return out


@router.post("/rooms/{room_id}/end")
async def force_end_room(room_id: str, admin: AdminUser):
    """Force-close a live room (moderation)."""
    res = await rooms_col.update_one({"_id": room_id}, {"$set": {"is_live": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"ok": True, "is_live": False}


@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, admin: AdminUser):
    """Delete a room record entirely."""
    res = await rooms_col.delete_one({"_id": room_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"ok": True}


class BroadcastBody(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    message: str = Field(min_length=1, max_length=500)


@router.post("/broadcast", status_code=201)
async def broadcast(body: BroadcastBody, admin: AdminUser):
    """Send an announcement to EVERY user: in-app notification + best-effort
    push. Shows in each user's Notifications feed as an announcement."""
    now = datetime.now(timezone.utc).isoformat()
    user_ids = [d["_id"] async for d in users_col.find({}, {"_id": 1})]
    if not user_ids:
        return {"sent": 0}
    docs = [
        {
            "_id": str(uuid.uuid4()),
            "user_id": uid,
            "actor_id": admin["_id"],
            "type": "announcement",
            "moment_id": None,
            "text": f"{body.title} — {body.message}",
            "read": False,
            "created_at": now,
        }
        for uid in user_ids
    ]
    await notifications_col.insert_many(docs)
    # Best-effort push in batches of 100 — never block the broadcast on it.
    for i in range(0, len(user_ids), 100):
        try:
            await send_push(
                user_ids[i : i + 100],
                {
                    "title": body.title,
                    "message": body.message,
                    "deeplink": "/notifications",
                },
            )
        except Exception:
            pass
    return {"sent": len(user_ids)}


@router.get("/moments")
async def list_all_moments(admin: AdminUser):
    docs = (
        await moments_col.find(
            {},
            {"user_id": 1, "text": 1, "image_id": 1, "likes": 1, "comment_count": 1, "created_at": 1},
        )
        .sort("created_at", -1)
        .to_list(100)
    )
    author_ids = list({d["user_id"] for d in docs})
    authors = (
        await users_col.find(
            {"_id": {"$in": author_ids}}, {"name": 1, "email": 1}
        ).to_list(len(author_ids))
        if author_ids
        else []
    )
    author_map = {u["_id"]: u for u in authors}
    out = []
    for d in docs:
        author = author_map.get(d["user_id"])
        out.append(
            {
                "id": d["_id"],
                "text": d.get("text"),
                "author_name": author.get("name") if author else "Unknown",
                "author_email": author.get("email") if author else None,
                "like_count": len(d.get("likes", [])),
                "comment_count": d.get("comment_count", 0),
                "has_image": bool(d.get("image_id")),
                "created_at": d.get("created_at"),
            }
        )
    return out


@router.delete("/moments/{moment_id}")
async def delete_moment(moment_id: str, admin: AdminUser):
    res = await moments_col.delete_one({"_id": moment_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Moment not found")
    return {"ok": True}


@router.get("/market")
async def market_items(admin: AdminUser):
    overrides = {d["_id"]: d async for d in market_config_col.find({})}
    items = []
    for item in CATALOG:
        o = overrides.get(item["id"], {})
        items.append(
            {
                **{k: v for k, v in item.items()},
                "price": o.get("price", item["price"]),
                "default_price": item["price"],
                "disabled": bool(o.get("disabled", False)),
            }
        )
    return items


class MarketItemUpdate(BaseModel):
    price: int | None = None
    disabled: bool | None = None


@router.put("/market/{item_id}")
async def update_market_item(item_id: str, body: MarketItemUpdate, admin: AdminUser):
    if item_id not in {i["id"] for i in CATALOG}:
        raise HTTPException(status_code=404, detail="Item not found")
    updates: dict = {}
    if body.price is not None:
        if body.price < 0:
            raise HTTPException(status_code=400, detail="Price must be >= 0")
        updates["price"] = body.price
    if body.disabled is not None:
        updates["disabled"] = body.disabled
    if updates:
        await market_config_col.update_one({"_id": item_id}, {"$set": updates}, upsert=True)
    return {"ok": True, **updates}


@router.get("/config")
async def read_config(admin: AdminUser):
    return await get_app_config()


class ConfigUpdate(BaseModel):
    free_translations_per_day: int | None = None
    free_rooms_per_day: int | None = None
    free_new_chats_per_day: int | None = None
    vip_new_chats_per_day: int | None = None
    app_name: str | None = None


@router.put("/config")
async def update_config(body: ConfigUpdate, admin: AdminUser):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    unknown = set(updates) - set(DEFAULTS)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown keys: {unknown}")
    if updates:
        await config_col.update_one({"_id": "app"}, {"$set": updates}, upsert=True)
    return await get_app_config()


def _integration_file_status(file_id: str) -> dict:
    meta = INTEGRATION_FILES[file_id]
    path: Path = meta["path"]
    exists = path.exists()
    return {
        "id": file_id,
        "label": meta["label"],
        "description": meta["description"],
        "exists": exists,
        "updated_at": (
            datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
            if exists
            else None
        ),
    }


@router.get("/integration-files")
async def list_integration_files(admin: AdminUser):
    """Build-time integration config files (e.g. Firebase google-services.json)
    that admins can upload/replace without a code change."""
    return [_integration_file_status(fid) for fid in INTEGRATION_FILES]


class IntegrationFileUpload(BaseModel):
    content_base64: str


@router.post("/integration-files/{file_id}")
async def upload_integration_file(
    file_id: str, body: IntegrationFileUpload, admin: AdminUser
):
    if file_id not in INTEGRATION_FILES:
        raise HTTPException(status_code=404, detail="Unknown integration file")
    try:
        raw = base64.b64decode(body.content_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file data")
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")
    path: Path = INTEGRATION_FILES[file_id]["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return _integration_file_status(file_id)


@router.delete("/integration-files/{file_id}")
async def remove_integration_file(file_id: str, admin: AdminUser):
    if file_id not in INTEGRATION_FILES:
        raise HTTPException(status_code=404, detail="Unknown integration file")
    path: Path = INTEGRATION_FILES[file_id]["path"]
    if path.exists():
        path.unlink()
    return _integration_file_status(file_id)



# ===================================================================== #
# Unified control — "Pro" sub-app (1-on-1 video tutoring)
# The single admin console switches between Main / Premium / Pro and
# fully controls each from here.
# ===================================================================== #
@router.get("/pro/stats")
async def pro_stats(admin: AdminUser):
    tutors = await pro_profiles_col.count_documents({"role": "tutor"})
    online_tutors = await pro_profiles_col.count_documents(
        {"role": "tutor", "is_online": True}
    )
    students = await pro_profiles_col.count_documents({"role": "student"})
    total_sessions = await pro_sessions_col.count_documents({})
    active_sessions = await pro_sessions_col.count_documents({"status": "active"})
    completed_sessions = await pro_sessions_col.count_documents(
        {"status": "completed"}
    )
    minutes_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$call_duration"}}}
    ]
    agg = await pro_sessions_col.aggregate(minutes_pipeline).to_list(1)
    total_minutes = round((agg[0]["total"] if agg else 0) / 60)
    return {
        "tutors": tutors,
        "online_tutors": online_tutors,
        "students": students,
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "completed_sessions": completed_sessions,
        "minutes_taught": total_minutes,
    }


@router.get("/pro/tutors")
async def pro_list_tutors(admin: AdminUser):
    docs = await pro_profiles_col.find({"role": "tutor"}).to_list(300)
    docs.sort(
        key=lambda d: (d.get("featured", False), d.get("rating", 0)), reverse=True
    )
    return [profile_public(d) for d in docs]


class ProTutorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    native_accent: str | None = None
    bio: str | None = ""
    teaches: list[str] = []
    specialties: list[str] = []
    hourly_rate: float = 15
    rating: float = 5.0
    avatar_url: str | None = None
    country: str | None = None
    featured: bool = False
    is_online: bool = True


@router.post("/pro/tutors", status_code=201)
async def pro_create_tutor(body: ProTutorCreate, admin: AdminUser):
    doc = {
        "_id": str(uuid.uuid4()),
        "external_user_id": f"pro-tutor-admin-{uuid.uuid4().hex[:8]}",
        "role": "tutor",
        "name": body.name,
        "native_accent": body.native_accent,
        "bio": body.bio or "",
        "teaches": body.teaches,
        "languages": body.teaches,
        "specialties": body.specialties,
        "hourly_rate": body.hourly_rate,
        "rating": body.rating,
        "reviews_count": 0,
        "lessons_taught": 0,
        "avatar_url": body.avatar_url,
        "video_intro_url": None,
        "country": body.country,
        "featured": body.featured,
        "is_online": body.is_online,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await pro_profiles_col.insert_one(doc)
    return profile_public(doc)


class ProTutorUpdate(BaseModel):
    name: str | None = None
    native_accent: str | None = None
    bio: str | None = None
    teaches: list[str] | None = None
    specialties: list[str] | None = None
    hourly_rate: float | None = None
    rating: float | None = None
    avatar_url: str | None = None
    country: str | None = None
    featured: bool | None = None
    is_online: bool | None = None


@router.put("/pro/tutors/{tutor_id}")
async def pro_update_tutor(tutor_id: str, body: ProTutorUpdate, admin: AdminUser):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "teaches" in updates:
        updates["languages"] = updates["teaches"]
    res = await pro_profiles_col.update_one(
        {"_id": tutor_id, "role": "tutor"}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tutor not found")
    doc = await pro_profiles_col.find_one({"_id": tutor_id})
    return profile_public(doc)


@router.delete("/pro/tutors/{tutor_id}")
async def pro_delete_tutor(tutor_id: str, admin: AdminUser):
    res = await pro_profiles_col.delete_one({"_id": tutor_id, "role": "tutor"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tutor not found")
    return {"ok": True}


@router.get("/pro/sessions")
async def pro_list_sessions(admin: AdminUser):
    docs = await pro_sessions_col.find({}).sort("created_at", -1).to_list(200)
    return [session_public(d) for d in docs]


@router.post("/pro/sessions/{session_id}/end")
async def pro_force_end_session(session_id: str, admin: AdminUser):
    res = await pro_sessions_col.update_one(
        {"_id": session_id},
        {"$set": {"status": "completed", "end_time": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True, "status": "completed"}


@router.get("/premium/stats")
async def premium_stats(admin: AdminUser):
    """Premium is the VIP-themed twin of the main app — controlled here by
    managing VIP membership + premium-visible content."""
    vip_users = await users_col.count_documents({"is_vip": True})
    vip_weekly = await users_col.count_documents({"is_vip": True, "vip_tier": "weekly"})
    vip_monthly = await users_col.count_documents({"is_vip": True, "vip_tier": "monthly"})
    vip_lifetime = await users_col.count_documents(
        {"is_vip": True, "vip_tier": "lifetime"}
    )
    return {
        "vip_users": vip_users,
        "vip_weekly": vip_weekly,
        "vip_monthly": vip_monthly,
        "vip_lifetime": vip_lifetime,
    }


@router.get("/premium/members")
async def premium_members(admin: AdminUser):
    docs = (
        await users_col.find({"is_vip": True}, {"password_hash": 0})
        .sort("created_at", -1)
        .to_list(300)
    )
    return [admin_user_row(d) for d in docs]



# --------------------------------------------------------------------------- #
# Deep user inspection: profile + activity + all conversations & transcripts.
# --------------------------------------------------------------------------- #
from db import db as _db  # noqa: E402

_gift_ledger = _db["gift_ledger"]
_store_orders = _db["store_orders"]


@router.get("/users/{user_id}/inspect")
async def inspect_user(user_id: str, admin: AdminUser):
    u = await users_col.find_one({"_id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    moments_count = await moments_col.count_documents({"user_id": user_id})
    rooms_hosted = await rooms_col.count_documents({"host_id": user_id})
    gifts_received = await _gift_ledger.count_documents({"to_id": user_id})
    orders = (
        await _store_orders.find({"user_id": user_id})
        .sort("created_at", -1)
        .to_list(5)
    )
    convs = (
        await conversations_col.find({"participant_ids": user_id})
        .sort("updated_at", -1)
        .to_list(50)
    )
    partner_ids = set()
    for c in convs:
        for p in c["participant_ids"]:
            if p != user_id:
                partner_ids.add(p)
    partners = await users_col.find({"_id": {"$in": list(partner_ids)}}).to_list(200)
    pmap = {p["_id"]: p for p in partners}
    conv_rows = []
    for c in convs:
        if c.get("is_group"):
            title = c.get("name") or "Group Chat"
        else:
            pid = next((p for p in c["participant_ids"] if p != user_id), None)
            title = (pmap.get(pid) or {}).get("name") or "Unknown"
        conv_rows.append(
            {
                "id": c["_id"],
                "title": title,
                "is_group": bool(c.get("is_group")),
                "member_count": len(c["participant_ids"]),
                "last_message": (c.get("last_message") or {}).get("text"),
                "updated_at": c.get("updated_at"),
            }
        )
    recent_moments = (
        await moments_col.find({"user_id": user_id})
        .sort("created_at", -1)
        .to_list(5)
    )
    return {
        "user": {
            "id": u["_id"],
            "name": u.get("name"),
            "email": u.get("email"),
            "avatar_url": u.get("avatar_url"),
            "country": u.get("country"),
            "native_language": u.get("native_language"),
            "learning_languages": u.get("learning_languages") or [],
            "coins": u.get("coins", 0),
            "diamonds": round(u.get("diamonds", 0) or 0, 2),
            "is_vip": bool(u.get("is_vip")),
            "banned": bool(u.get("banned")),
            "restricted": bool(u.get("restricted")),
            "streak_count": u.get("streak_count", 0),
            "followers_count": u.get("followers_count", 0),
            "created_at": u.get("created_at"),
            "last_active": u.get("last_active"),
            "bio": u.get("bio"),
        },
        "stats": {
            "moments": moments_count,
            "rooms_hosted": rooms_hosted,
            "gifts_received": gifts_received,
            "conversations": len(convs),
            "orders": len(orders),
        },
        "recent_moments": [
            {"id": m["_id"], "text": m.get("text"), "created_at": m.get("created_at"), "likes": len(m.get("likes") or [])}
            for m in recent_moments
        ],
        "orders": [
            {"id": o["_id"], "total": o.get("total"), "status": o.get("status"), "created_at": o.get("created_at")}
            for o in orders
        ],
        "conversations": conv_rows,
    }


@router.get("/conversations/{conversation_id}/messages")
async def admin_conversation_messages(conversation_id: str, admin: AdminUser):
    docs = (
        await messages_col.find({"conversation_id": conversation_id})
        .sort("created_at", 1)
        .to_list(300)
    )
    sender_ids = list({d.get("sender_id") for d in docs if d.get("sender_id")})
    senders = await users_col.find({"_id": {"$in": sender_ids}}).to_list(len(sender_ids))
    smap = {u["_id"]: u.get("name") or "?" for u in senders}
    return [
        {
            "id": d["_id"],
            "sender_id": d.get("sender_id"),
            "sender_name": smap.get(d.get("sender_id")) or ("System" if d.get("type") == "system" else "?"),
            "text": d.get("text"),
            "type": d.get("type", "text"),
            "recalled": bool(d.get("recalled")),
            "created_at": d.get("created_at"),
        }
        for d in docs
    ]


# --------------------------------------------------------------------------- #
# Store orders management.
# --------------------------------------------------------------------------- #
class OrderStatusBody(BaseModel):
    status: str  # pending | shipped | delivered | cancelled


@router.get("/orders")
async def admin_orders(admin: AdminUser):
    docs = await _store_orders.find({}).sort("created_at", -1).to_list(100)
    uids = list({d["user_id"] for d in docs})
    users = await users_col.find({"_id": {"$in": uids}}).to_list(len(uids))
    umap = {u["_id"]: u.get("name") or "?" for u in users}
    return [
        {
            "id": d["_id"],
            "user_name": umap.get(d["user_id"]),
            "items": d.get("items", []),
            "total": d.get("total"),
            "status": d.get("status"),
            "name": d.get("name"),
            "phone": d.get("phone"),
            "address": d.get("address"),
            "created_at": d.get("created_at"),
        }
        for d in docs
    ]


@router.put("/orders/{order_id}")
async def set_order_status(order_id: str, body: OrderStatusBody, admin: AdminUser):
    if body.status not in {"pending", "shipped", "delivered", "cancelled"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await _store_orders.update_one(
        {"_id": order_id}, {"$set": {"status": body.status}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True, "status": body.status}
