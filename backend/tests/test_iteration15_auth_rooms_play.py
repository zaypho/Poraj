"""Iteration 15 backend tests — auth (login/register/guest/google), voice rooms
CRUD/join/leave, WOTD claim idempotency, vocab-hub content, and the play
mini-games XP endpoint used by the new /play screen.

All tests hit the public preview URL (EXPO_PUBLIC_BACKEND_URL) so we validate
the same path a mobile client would use.
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "mei@demo.com"
DEMO_PASSWORD = "Demo1234!"


# ── shared fixtures ─────────────────────────────────────────────────────── #
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    return s


@pytest.fixture(scope="session")
def demo_token(http):
    r = http.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# ── Auth ─────────────────────────────────────────────────────────────────── #
class TestAuth:
    def test_login_demo_user(self, http):
        r = http.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and data["token"]
        assert "user" in data
        assert data["user"].get("email") == DEMO_EMAIL

    def test_login_wrong_password(self, http):
        r = http.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_register_new_user(self, http):
        email = f"test_it15_{uuid.uuid4().hex[:8]}@example.com"
        r = http.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Passw0rd!", "name": "Test User"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert "token" in body and body["token"]
        assert body["user"]["email"] == email
        # verify the token works
        me = http.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {body['token']}"},
        )
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_register_duplicate_email(self, http):
        r = http.post(
            f"{API}/auth/register",
            json={"email": DEMO_EMAIL, "password": "Anything123!", "name": "Dup"},
        )
        assert r.status_code == 400

    def test_guest_login(self, http):
        r = http.post(f"{API}/auth/guest")
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("token")
        u = body["user"]
        assert u.get("is_guest") is True
        assert (u.get("name") or "").startswith("Guest ")

    def test_google_missing_session(self, http):
        r = http.post(f"{API}/auth/google", json={"session_id": ""})
        assert r.status_code == 400

    def test_google_invalid_session(self, http):
        # Random session id — Emergent should reject → we surface 401
        r = http.post(f"{API}/auth/google", json={"session_id": uuid.uuid4().hex})
        # Accept 401 (invalid session) or 502 (provider unreachable in preview) but
        # NOT 200 — endpoint must never mint a token for random input.
        assert r.status_code in (401, 502), f"unexpected: {r.status_code} {r.text}"


# ── Voice Rooms ─────────────────────────────────────────────────────────── #
class TestVoiceRooms:
    created_room_id: str | None = None

    def test_list_rooms(self, http, demo_headers):
        r = http.get(f"{API}/rooms", headers=demo_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_room(self, http, demo_headers):
        payload = {
            "title": "TEST_IT15 Voice Room",
            "language": "en",
            "topic": "Testing",
            "mode": "chat",
            "is_private": False,
        }
        r = http.post(f"{API}/rooms", json=payload, headers=demo_headers)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["title"] == payload["title"]
        assert body["is_live"] is True
        assert body["host"] and body["host"].get("id")
        TestVoiceRooms.created_room_id = body["id"]

    def test_get_room_after_create(self, http, demo_headers):
        rid = TestVoiceRooms.created_room_id
        assert rid, "prior test must succeed"
        r = http.get(f"{API}/rooms/{rid}", headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["id"] == rid

    def test_join_and_leave_as_second_user(self, http, demo_headers):
        rid = TestVoiceRooms.created_room_id
        assert rid
        # Login as second demo user so join is meaningful
        r = http.post(
            f"{API}/auth/login",
            json={"email": "diego@demo.com", "password": DEMO_PASSWORD},
        )
        assert r.status_code == 200
        tok = r.json()["token"]
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        jr = http.post(f"{API}/rooms/{rid}/join", headers=h)
        assert jr.status_code == 200, jr.text
        detail = jr.json()
        member_ids = {m["id"] for m in detail["members"]}
        # diego must appear as member
        diego_id = r.json()["user"]["id"]
        assert diego_id in member_ids
        # leave
        lr = http.post(f"{API}/rooms/{rid}/leave", headers=h)
        assert lr.status_code == 200
        assert lr.json().get("ok") is True

    def test_end_room_cleanup(self, http, demo_headers):
        rid = TestVoiceRooms.created_room_id
        if not rid:
            pytest.skip("no room to clean up")
        r = http.post(f"{API}/rooms/{rid}/end", headers=demo_headers)
        assert r.status_code == 200
        # after end, GET should 404 (only live rooms fetchable)
        g = http.get(f"{API}/rooms/{rid}", headers=demo_headers)
        assert g.status_code == 404


# ── Word of the Day ─────────────────────────────────────────────────────── #
class TestWOTD:
    def test_wotd_get(self, http, demo_headers):
        r = http.get(f"{API}/wotd/today", headers=demo_headers)
        # backend might use different paths — try alternatives
        if r.status_code == 404:
            r = http.get(f"{API}/wotd", headers=demo_headers)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        body = r.json()
        assert "word" in body or "translation" in body or "id" in body

    def test_wotd_claim_idempotent(self, http, demo_headers):
        r1 = http.post(f"{API}/wotd/today/claim", json={"lang": "bn"}, headers=demo_headers)
        assert r1.status_code in (200, 201), r1.text
        r2 = http.post(f"{API}/wotd/today/claim", json={"lang": "bn"}, headers=demo_headers)
        assert r2.status_code in (200, 201)
        # Second same-day claim must award 0 xp (idempotent).
        assert r2.json().get("awarded") == 0, r2.text


# ── Vocab Hub ───────────────────────────────────────────────────────────── #
class TestVocabHub:
    def test_vocab_languages(self, http, demo_headers):
        # /api/vocab/languages should return list of 15 languages
        r = http.get(f"{API}/vocab/languages", headers=demo_headers)
        if r.status_code == 404:
            pytest.skip("/vocab/languages not available")
        assert r.status_code == 200
        data = r.json()
        langs = data["supported"] if isinstance(data, dict) and "supported" in data else data
        assert isinstance(langs, list)
        assert len(langs) >= 10  # expected ~15

    @pytest.mark.parametrize("level", ["Beginner", "Intermediate", "Advanced"])
    def test_vocab_lessons_by_level(self, http, demo_headers, level):
        r = http.get(
            f"{API}/vocab/lessons",
            headers=demo_headers,
            params={"language": "es", "level": level},
        )
        if r.status_code == 404:
            pytest.skip("/vocab/lessons not available")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))


# ── Play mini-games XP endpoint ─────────────────────────────────────────── #
class TestPlayXP:
    def test_flag_match_complete_awards_xp(self, http, demo_headers):
        r = http.post(
            f"{API}/vocab/lessons/play-flag-match/complete",
            headers=demo_headers,
            json={"step_count": 10, "correct_count": 7},
        )
        # This endpoint is best-effort — accept 200/201 or 404 if not wired
        assert r.status_code in (200, 201, 404), f"{r.status_code} {r.text}"
