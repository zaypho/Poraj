"""
Iteration 18 — 1:1 calling & voice-room WebRTC signaling relay tests.

Verifies /api/ws relays these frames from A → B by 'to' field:
  * call_offer / call_answer / call_ice / call_decline / call_end
  * rtc_offer  / rtc_answer  / rtc_ice

Also verifies:
  * call_offer to an OFFLINE user returns 'call_unavailable' to caller.
  * call_offer to an ONLINE user forwards to callee and includes 'caller' user_card.
  * Invalid JWT closes the socket.

Run: cd /app/backend && python -m pytest tests/test_iteration18_calls_ws.py -v
"""

import asyncio
import json

import pytest
import requests
import websockets

BASE = "http://localhost:8001/api"
WS_BASE = "ws://localhost:8001/api/ws"


def _login(email, password="Demo1234!"):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


# ---------- Auth guard ----------
@pytest.mark.asyncio
async def test_ws_rejects_invalid_token():
    with pytest.raises(Exception):
        async with websockets.connect(f"{WS_BASE}?token=nope") as ws:
            await asyncio.wait_for(ws.recv(), timeout=3)


# ---------- 1:1 call signaling ----------
@pytest.mark.asyncio
async def test_call_offer_online_forwarded_with_caller_card():
    """A→B call_offer while B is online should reach B with 'from'=A + 'caller' card."""
    tok_a, user_a = _login("mei@demo.com")
    tok_b, user_b = _login("diego@demo.com")

    async with websockets.connect(f"{WS_BASE}?token={tok_a}") as ws_a, \
               websockets.connect(f"{WS_BASE}?token={tok_b}") as ws_b:
        await asyncio.sleep(0.3)
        await ws_a.send(json.dumps({
            "type": "call_offer",
            "to": user_b["id"],
            "sdp": {"type": "offer", "sdp": "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n"},
        }))
        raw = await asyncio.wait_for(ws_b.recv(), timeout=5)
        evt = json.loads(raw)
        assert evt["type"] == "call_offer"
        assert evt["from"] == user_a["id"]
        assert evt.get("caller", {}).get("id") == user_a["id"]
        assert evt.get("sdp", {}).get("type") == "offer"


@pytest.mark.asyncio
async def test_call_offer_offline_returns_call_unavailable():
    """B not connected → caller A receives 'call_unavailable' echo."""
    tok_a, _ = _login("mei@demo.com")
    _, user_b = _login("diego@demo.com")  # login but don't open ws for B

    async with websockets.connect(f"{WS_BASE}?token={tok_a}") as ws_a:
        await asyncio.sleep(0.2)
        await ws_a.send(json.dumps({
            "type": "call_offer",
            "to": user_b["id"],
            "sdp": {"type": "offer", "sdp": "v=0\r\n"},
        }))
        raw = await asyncio.wait_for(ws_a.recv(), timeout=5)
        evt = json.loads(raw)
        assert evt["type"] == "call_unavailable"
        assert evt["from"] == user_b["id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("etype", ["call_answer", "call_ice", "call_decline", "call_end"])
async def test_call_relay_events_forwarded(etype):
    tok_a, user_a = _login("mei@demo.com")
    tok_b, user_b = _login("diego@demo.com")
    async with websockets.connect(f"{WS_BASE}?token={tok_a}") as ws_a, \
               websockets.connect(f"{WS_BASE}?token={tok_b}") as ws_b:
        await asyncio.sleep(0.3)
        payload = {"type": etype, "to": user_b["id"], "payload": "x"}
        if etype == "call_answer":
            payload["sdp"] = {"type": "answer", "sdp": "v=0\r\n"}
        if etype == "call_ice":
            payload["candidate"] = {"candidate": "candidate:1 1 udp 1 1.1.1.1 1 typ host"}
        await ws_a.send(json.dumps(payload))
        raw = await asyncio.wait_for(ws_b.recv(), timeout=5)
        evt = json.loads(raw)
        assert evt["type"] == etype
        assert evt["from"] == user_a["id"]


# ---------- Voice-room mesh signaling ----------
@pytest.mark.asyncio
@pytest.mark.parametrize("etype", ["rtc_offer", "rtc_answer", "rtc_ice"])
async def test_room_rtc_events_forwarded(etype):
    tok_a, user_a = _login("mei@demo.com")
    tok_b, user_b = _login("diego@demo.com")
    async with websockets.connect(f"{WS_BASE}?token={tok_a}") as ws_a, \
               websockets.connect(f"{WS_BASE}?token={tok_b}") as ws_b:
        await asyncio.sleep(0.3)
        await ws_a.send(json.dumps({
            "type": etype,
            "to": user_b["id"],
            "sdp": {"type": etype.split("_")[1], "sdp": "v=0\r\n"} if etype != "rtc_ice" else None,
            "candidate": {"candidate": "candidate:2 1 udp 1 1.1.1.1 1 typ host"}
                if etype == "rtc_ice" else None,
            "room_id": "test-room-id",
        }))
        raw = await asyncio.wait_for(ws_b.recv(), timeout=5)
        evt = json.loads(raw)
        assert evt["type"] == etype
        assert evt["from"] == user_a["id"]
        assert evt.get("room_id") == "test-room-id"


# ---------- Voice room create → join → mic → end ----------
def _headers(t):
    return {"Authorization": f"Bearer {t}"}


def test_voice_room_membership_flow():
    tok_a, user_a = _login("mei@demo.com")
    tok_b, user_b = _login("diego@demo.com")

    # Host creates
    r = requests.post(
        f"{BASE}/rooms",
        json={"title": "TEST_iter18 signaling", "language": "en"},
        headers=_headers(tok_a),
    )
    assert r.status_code == 201, r.text
    room = r.json()
    rid = room["id"]

    try:
        # B joins as listener
        r = requests.post(f"{BASE}/rooms/{rid}/join", headers=_headers(tok_b))
        assert r.status_code == 200
        detail = r.json()
        member_ids = {m["id"] for m in detail["members"]}
        assert user_a["id"] in member_ids and user_b["id"] in member_ids

        # Host mic toggle (host is speaker by default: mic_on=True → toggles off)
        r = requests.post(f"{BASE}/rooms/{rid}/mic", headers=_headers(tok_a))
        assert r.status_code == 200
        assert r.json()["mic_on"] is False

        # Listener cannot toggle mic
        r = requests.post(f"{BASE}/rooms/{rid}/mic", headers=_headers(tok_b))
        assert r.status_code == 403

        # Detail reflects B still there
        r = requests.get(f"{BASE}/rooms/{rid}", headers=_headers(tok_a))
        assert r.status_code == 200
        assert r.json()["member_count"] == 2
    finally:
        # Host ends room (cleanup)
        requests.post(f"{BASE}/rooms/{rid}/end", headers=_headers(tok_a))


# ---------- WS delivers room_update on join ----------
@pytest.mark.asyncio
async def test_ws_room_update_on_join():
    tok_a, user_a = _login("mei@demo.com")
    tok_b, user_b = _login("diego@demo.com")

    # Host creates via HTTP first (WS not used for creation)
    r = requests.post(
        f"{BASE}/rooms",
        json={"title": "TEST_iter18 ws-join", "language": "en"},
        headers=_headers(tok_a),
    )
    assert r.status_code == 201
    rid = r.json()["id"]

    try:
        async with websockets.connect(f"{WS_BASE}?token={tok_a}") as ws_a:
            await asyncio.sleep(0.3)
            # B joins via HTTP — host A's WS should receive a room_update
            r = requests.post(f"{BASE}/rooms/{rid}/join", headers=_headers(tok_b))
            assert r.status_code == 200
            got_update = False
            # Drain up to 3 events looking for room_update
            for _ in range(3):
                try:
                    raw = await asyncio.wait_for(ws_a.recv(), timeout=3)
                    evt = json.loads(raw)
                    if evt.get("type") == "room_update":
                        got_update = True
                        break
                except asyncio.TimeoutError:
                    break
            assert got_update, "No room_update event received by host after join"
    finally:
        requests.post(f"{BASE}/rooms/{rid}/end", headers=_headers(tok_a))
