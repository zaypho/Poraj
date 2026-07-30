import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from auth_utils import CurrentUser
from db import market_config_col, users_col
from models import user_public

router = APIRouter(prefix="/market", tags=["market"])

# Static marketplace catalog — prices in coins.
CATALOG = [
    {"id": "vip_weekly", "type": "vip", "name": "VIP — 7 Days", "emoji": "✨", "price": 150, "duration_days": 7, "color": "#F59E0B", "desc": "Try VIP: badge, 3 learning languages & unlimited chats for a week"},
    {"id": "vip_monthly", "type": "vip", "name": "VIP — 1 Month", "emoji": "💎", "price": 500, "duration_days": 30, "color": "#F59E0B", "desc": "Gold VIP badge, 3 learning languages, unlimited chats"},
    {"id": "vip_lifetime", "type": "vip", "name": "VIP — Lifetime", "emoji": "👑", "price": 2000, "duration_days": None, "color": "#8B5CF6", "desc": "Purple lifetime VIP badge & all VIP perks forever"},
    {"id": "badge_star", "type": "badge", "name": "Star Badge", "emoji": "⭐", "price": 100, "duration_days": 7, "desc": "Shine next to your name for 7 days"},
    {"id": "badge_fire", "type": "badge", "name": "Fire Badge", "emoji": "🔥", "price": 100, "duration_days": 7, "desc": "Show you're on fire for 7 days"},
    {"id": "badge_crown", "type": "badge", "name": "Crown Badge", "emoji": "👑", "price": 150, "duration_days": 7, "desc": "Royal look for 7 days"},
    {"id": "badge_heart", "type": "badge", "name": "Heart Badge", "emoji": "💖", "price": 80, "duration_days": 7, "desc": "Spread the love for 7 days"},
    {"id": "frame_gold", "type": "frame", "name": "Gold Ring", "emoji": "🟡", "price": 150, "duration_days": 7, "color": "#F59E0B", "desc": "Golden ring around your avatar for 7 days"},
    {"id": "frame_blue", "type": "frame", "name": "Sky Ring", "emoji": "🔵", "price": 120, "duration_days": 7, "color": "#0EA5E9", "desc": "Sky-blue avatar ring for 7 days"},
    {"id": "frame_pink", "type": "frame", "name": "Rose Ring", "emoji": "🌸", "price": 120, "duration_days": 7, "color": "#EC4899", "desc": "Rose avatar ring for 7 days"},
    {"id": "frame_green", "type": "frame", "name": "Emerald Ring", "emoji": "🟢", "price": 120, "duration_days": 7, "color": "#22C55E", "desc": "Emerald avatar ring for 7 days"},
    {"id": "frame_rainbow", "type": "frame", "name": "Rainbow Pulse", "emoji": "🌈", "price": 300, "duration_days": 7, "color": "#F59E0B", "colors": ["#F59E0B", "#EC4899", "#8B5CF6", "#0EA5E9"], "animated": True, "desc": "Animated rainbow ring cycling colors — 7 days"},
    {"id": "frame_neon", "type": "frame", "name": "Neon Glow", "emoji": "💫", "price": 250, "duration_days": 7, "color": "#22D3EE", "colors": ["#22D3EE", "#22C55E", "#22D3EE"], "animated": True, "desc": "Glowing animated neon ring — 7 days"},
]
ITEM_MAP = {i["id"]: i for i in CATALOG}
VIP_TIERS = {"vip_weekly": "weekly", "vip_monthly": "monthly", "vip_lifetime": "lifetime"}


class BuyRequest(BaseModel):
    item_id: str


TOPUP_AMOUNTS = {100, 500, 1000, 2000}


class TopupRequest(BaseModel):
    amount: int


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("")
async def get_market(current_user: CurrentUser):
    now = _now().isoformat()
    active_badge = current_user.get("active_badge") or {}
    active_frame = current_user.get("active_frame") or {}
    items = []
    overrides = {d["_id"]: d async for d in market_config_col.find({})}
    for item in CATALOG:
        o = overrides.get(item["id"], {})
        if o.get("disabled"):
            continue
        entry = dict(item)
        entry["price"] = o.get("price", item["price"])
        if item["type"] == "vip":
            entry["active"] = bool(
                current_user.get("is_vip")
                and current_user.get("vip_tier") == VIP_TIERS[item["id"]]
                and (not current_user.get("vip_expires_at") or current_user["vip_expires_at"] > now)
            )
        elif item["type"] == "badge":
            entry["active"] = active_badge.get("id") == item["id"] and (
                not active_badge.get("expires_at") or active_badge["expires_at"] > now
            )
        else:
            entry["active"] = active_frame.get("id") == item["id"] and (
                not active_frame.get("expires_at") or active_frame["expires_at"] > now
            )
        items.append(entry)
    return {"coins": current_user.get("coins", 0), "items": items}


@router.post("/buy")
async def buy_item(body: BuyRequest, current_user: CurrentUser):
    item = ITEM_MAP.get(body.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    override = await market_config_col.find_one({"_id": body.item_id}) or {}
    if override.get("disabled"):
        raise HTTPException(status_code=400, detail="Item is currently unavailable")
    price = override.get("price", item["price"])
    coins = current_user.get("coins", 0)
    if coins < price:
        raise HTTPException(status_code=400, detail="Not enough coins")
    updates: dict = {"coins": coins - price}
    expires = (
        (_now() + timedelta(days=item["duration_days"])).isoformat()
        if item.get("duration_days")
        else None
    )
    if item["type"] == "vip":
        updates["is_vip"] = True
        updates["vip_tier"] = VIP_TIERS[item["id"]]
        updates["vip_expires_at"] = expires
    elif item["type"] == "badge":
        updates["active_badge"] = {
            "id": item["id"],
            "emoji": item["emoji"],
            "expires_at": expires,
        }
    else:
        updates["active_frame"] = {
            "id": item["id"],
            "color": item["color"],
            "colors": item.get("colors"),
            "animated": item.get("animated", False),
            "expires_at": expires,
        }
    await users_col.update_one({"_id": current_user["_id"]}, {"$set": updates})
    current_user.update(updates)
    return {"coins": updates["coins"], "user": user_public(current_user)}


@router.post("/topup")
async def topup(body: TopupRequest, current_user: CurrentUser):
    """Demo top-up — adds coins instantly (real payments come later)."""
    if body.amount not in TOPUP_AMOUNTS:
        raise HTTPException(status_code=400, detail="Invalid top-up amount")
    coins = current_user.get("coins", 0) + body.amount
    await users_col.update_one({"_id": current_user["_id"]}, {"$set": {"coins": coins}})
    return {"coins": coins}


# --------------------------------------------------------------------------- #
# Boost purchases — coins are deducted and the moment/profile is pinned to the
# top of its feed for a limited time window (NOT permanent).
# --------------------------------------------------------------------------- #


from db import moments_col  # noqa: E402

BOOST_PRICES = {
    "moment": {500: 239, 1000: 429, 2000: 799, 3000: 1099},
    "profile": {500: 159, 1000: 299, 2000: 549, 3000: 799},
}
BOOST_HOURS = 24


class BoostBody(BaseModel):
    kind: str  # "moment" | "profile"
    size: int
    moment_id: str | None = None


@router.post("/boost")
async def purchase_boost(body: BoostBody, current_user: CurrentUser):
    prices = BOOST_PRICES.get(body.kind)
    if not prices or body.size not in prices:
        raise HTTPException(status_code=400, detail="Invalid boost package")
    price = prices[body.size]
    coins = current_user.get("coins", 0)
    if coins < price:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough coins — this boost costs {price} coins.",
        )
    until = (datetime.now(timezone.utc) + timedelta(hours=BOOST_HOURS)).isoformat()
    if body.kind == "moment":
        if not body.moment_id:
            raise HTTPException(status_code=400, detail="moment_id is required")
        doc = await moments_col.find_one({"_id": body.moment_id})
        if not doc or doc["user_id"] != current_user["_id"]:
            raise HTTPException(status_code=404, detail="Moment not found")
        await moments_col.update_one(
            {"_id": body.moment_id}, {"$set": {"boost_until": until}}
        )
    else:
        await users_col.update_one(
            {"_id": current_user["_id"]}, {"$set": {"boost_until": until}}
        )
    await users_col.update_one(
        {"_id": current_user["_id"]}, {"$inc": {"coins": -price}}
    )
    return {"ok": True, "coins": coins - price, "boost_until": until}


# --------------------------------------------------------------------------- #
# Wallet: coins top-up (MOCK payment), diamonds, gift ledger, transactions.
# --------------------------------------------------------------------------- #
from db import db as _db  # noqa: E402

wallet_tx_col = _db["wallet_tx"]
gift_ledger_col = _db["gift_ledger"]

TOPUP_PACKS = {8: "KZT 66.34", 64: "KZT 499", 324: "KZT 2490", 649: "KZT 4990", 3249: "KZT 24990", 10334: "KZT 79990"}
VIP_COST = {3: 94, 7: 218, 30: 931, 60: 1862, 90: 2793}


class TopupBody(BaseModel):
    coins: int


class RedeemBody(BaseModel):
    what: str  # "coins" | "vip"
    days: int | None = None


async def _tx(user_id: str, kind: str, amount: float, label: str):
    await wallet_tx_col.insert_one(
        {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "kind": kind,
            "amount": amount,
            "label": label,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )


@router.get("/wallet")
async def wallet(current_user: CurrentUser):
    return {
        "coins": current_user.get("coins", 0),
        "diamonds": round(current_user.get("diamonds", 0) or 0, 2),
    }


@router.post("/topup-pack")
async def topup_pack(body: TopupBody, current_user: CurrentUser):
    if body.coins not in TOPUP_PACKS:
        raise HTTPException(status_code=400, detail="Invalid package")
    await users_col.update_one(
        {"_id": current_user["_id"]}, {"$inc": {"coins": body.coins}}
    )
    await _tx(current_user["_id"], "coin", body.coins, f"Top up ({TOPUP_PACKS[body.coins]})")
    return {"ok": True, "coins": current_user.get("coins", 0) + body.coins}


@router.post("/redeem")
async def redeem(body: RedeemBody, current_user: CurrentUser):
    diamonds = current_user.get("diamonds", 0) or 0
    if body.what == "coins":
        if diamonds < 100:
            raise HTTPException(status_code=400, detail="You need at least 100 diamonds to redeem")
        coins_gained = int(diamonds * 1.1)
        await users_col.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"coins": coins_gained}, "$set": {"diamonds": 0}},
        )
        await _tx(current_user["_id"], "diamond", -diamonds, "Redeemed for coins")
        await _tx(current_user["_id"], "coin", coins_gained, "Diamond exchange (+10% bonus)")
        return {"ok": True, "coins_gained": coins_gained}
    if body.what == "vip":
        cost = VIP_COST.get(body.days or 0)
        if not cost:
            raise HTTPException(status_code=400, detail="Invalid VIP package")
        if diamonds < cost:
            raise HTTPException(status_code=400, detail=f"You need {cost} diamonds for {body.days} days of VIP")
        from datetime import timedelta as _td

        cur = current_user.get("vip_until")
        base = datetime.now(timezone.utc)
        try:
            if cur:
                cur_dt = datetime.fromisoformat(cur)
                if cur_dt > base:
                    base = cur_dt
        except ValueError:
            pass
        until = (base + _td(days=body.days)).isoformat()
        await users_col.update_one(
            {"_id": current_user["_id"]},
            {"$inc": {"diamonds": -cost}, "$set": {"is_vip": True, "vip_until": until}},
        )
        await _tx(current_user["_id"], "diamond", -cost, f"Redeemed {body.days}d VIP")
        return {"ok": True, "vip_until": until}
    raise HTTPException(status_code=400, detail="Invalid redeem type")


@router.get("/gifts")
async def gift_history(current_user: CurrentUser, dir: str = "received"):
    field = "to_id" if dir == "received" else "from_id"
    docs = (
        await gift_ledger_col.find({field: current_user["_id"]})
        .sort("created_at", -1)
        .to_list(100)
    )
    other_ids = list({d["from_id" if dir == "received" else "to_id"] for d in docs})
    others = await users_col.find({"_id": {"$in": other_ids}}).to_list(len(other_ids))
    omap = {o["_id"]: user_card(o) for o in others}
    total_value = round(sum(d.get("diamonds", 0) for d in docs), 2)
    return {
        "total_value": total_value,
        "count": len(docs),
        "items": [
            {
                "id": d["_id"],
                "user": omap.get(d["from_id" if dir == "received" else "to_id"]),
                "emoji": d["emoji"],
                "name": d["name"],
                "diamonds": d.get("diamonds", 0),
                "created_at": d["created_at"],
            }
            for d in docs
        ],
    }


@router.get("/transactions")
async def transactions(current_user: CurrentUser, kind: str = "coin"):
    docs = (
        await wallet_tx_col.find({"user_id": current_user["_id"], "kind": kind})
        .sort("created_at", -1)
        .to_list(100)
    )
    totals = round(sum(d["amount"] for d in docs if d["amount"] > 0), 2)
    spent = round(-sum(d["amount"] for d in docs if d["amount"] < 0), 2)
    return {
        "totals": totals,
        "spent": spent,
        "items": [
            {
                "id": d["_id"],
                "amount": d["amount"],
                "label": d["label"],
                "created_at": d["created_at"],
            }
            for d in docs
        ],
    }
