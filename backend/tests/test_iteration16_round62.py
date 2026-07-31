"""
Iteration 16 (round 62) — leaderboard, placement test, moment bookmarks,
study-room pomodoro, admin hardening.

Uses the public preview URL from EXPO_PUBLIC_BACKEND_URL.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "").rstrip("/") or \
    (open("/app/frontend/.env").read().split("EXPO_PUBLIC_BACKEND_URL=")[1].splitlines()[0].strip().strip('"'))

API = f"{BASE_URL}/api"

MEI = ("mei@demo.com", "Demo1234!")
DIEGO = ("diego@demo.com", "Demo1234!")
ADMIN = ("admin@lingua.app", "Admin1234!")


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email} → {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def mei_token() -> str:
    return _login(*MEI)


@pytest.fixture(scope="module")
def diego_token() -> str:
    return _login(*DIEGO)


@pytest.fixture(scope="module")
def admin_token() -> str:
    return _login(*ADMIN)


def _h(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}"}


# ── BACKEND 1 — Weekly leaderboard ─────────────────────────────────────────
class TestLeaderboard:
    def test_global_weekly(self, mei_token):
        r = requests.get(f"{API}/leaderboard/weekly?scope=global", headers=_h(mei_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["scope"] == "global"
        for k in ("week_start", "week_end", "entries", "me"):
            assert k in data
        assert isinstance(data["entries"], list)
        assert "user" in data["me"] and "rank" in data["me"] and "xp" in data["me"]

    def test_friends_weekly(self, mei_token):
        r = requests.get(f"{API}/leaderboard/weekly?scope=friends", headers=_h(mei_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["scope"] == "friends"

    def test_unauth_401(self):
        r = requests.get(f"{API}/leaderboard/weekly", timeout=10)
        assert r.status_code == 401


# ── BACKEND 2 — Placement test ─────────────────────────────────────────────
CORRECT_ANSWERS = {
    "pl-e1": "Glad", "pl-e2": "Small", "pl-e3": "goes", "pl-e4": "Purple",
    "pl-m1": "Improve", "pl-m2": "since", "pl-m3": "trust",
    "pl-h1": "Ephemeral", "pl-h2": "rejected", "pl-h3": "Thorough",
}


class TestPlacement:
    def test_questions_returns_10_no_answer_leak(self, mei_token):
        r = requests.get(f"{API}/vocab/placement/questions", headers=_h(mei_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("attempt_id")
        qs = data["questions"]
        assert len(qs) == 10
        for q in qs:
            assert "answer" not in q, f"answer leaked in question {q['id']}"
            assert set(q.keys()) >= {"id", "prompt", "options", "tier"}
            assert len(q["options"]) >= 3

    def test_full_correct_submit_advanced(self, mei_token):
        r = requests.get(f"{API}/vocab/placement/questions", headers=_h(mei_token), timeout=15)
        attempt_id = r.json()["attempt_id"]
        body = {"attempt_id": attempt_id, "answers": CORRECT_ANSWERS}
        r2 = requests.post(f"{API}/vocab/placement/submit", json=body, headers=_h(mei_token), timeout=15)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert d["score"] == 10 and d["total"] == 10 and d["level"] == "Advanced"

        # Verify placement_level persisted on user via /vocab/me/stats
        stats = requests.get(f"{API}/vocab/me/stats", headers=_h(mei_token), timeout=10).json()
        assert stats.get("placement_level") == "Advanced"

    def test_beginner_level_all_wrong(self, mei_token):
        r = requests.get(f"{API}/vocab/placement/questions", headers=_h(mei_token), timeout=15)
        attempt_id = r.json()["attempt_id"]
        wrong = {qid: "__NOPE__" for qid in CORRECT_ANSWERS}
        r2 = requests.post(f"{API}/vocab/placement/submit",
                           json={"attempt_id": attempt_id, "answers": wrong},
                           headers=_h(mei_token), timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["score"] == 0 and d["level"] == "Beginner"

    def test_bad_attempt_id_404(self, mei_token):
        r = requests.post(f"{API}/vocab/placement/submit",
                          json={"attempt_id": "does-not-exist", "answers": {}},
                          headers=_h(mei_token), timeout=10)
        assert r.status_code == 404


# ── BACKEND 3 — Moment bookmarks ───────────────────────────────────────────
class TestMomentBookmarks:
    def test_bookmark_toggle_and_saved_list(self, mei_token):
        # Create a moment first
        r = requests.post(f"{API}/moments",
                          json={"text": f"TEST_it16 bookmark moment {uuid.uuid4().hex[:8]}"},
                          headers=_h(mei_token), timeout=15)
        assert r.status_code == 201, r.text
        mid = r.json()["id"]

        # Toggle ON
        r1 = requests.post(f"{API}/moments/{mid}/bookmark", headers=_h(mei_token), timeout=10)
        assert r1.status_code == 200
        assert r1.json()["saved"] is True

        # Listed on saved endpoint
        listed = requests.get(f"{API}/moments/saved/list", headers=_h(mei_token), timeout=10).json()
        assert any(m["id"] == mid for m in listed)
        target = [m for m in listed if m["id"] == mid][0]
        assert target["saved"] is True

        # /moments list includes saved flag
        feed = requests.get(f"{API}/moments", headers=_h(mei_token), timeout=10).json()
        feed_target = next((m for m in feed if m["id"] == mid), None)
        assert feed_target and feed_target["saved"] is True

        # Toggle OFF (idempotent path both ways)
        r2 = requests.post(f"{API}/moments/{mid}/bookmark", headers=_h(mei_token), timeout=10)
        assert r2.status_code == 200 and r2.json()["saved"] is False

        listed2 = requests.get(f"{API}/moments/saved/list", headers=_h(mei_token), timeout=10).json()
        assert not any(m["id"] == mid for m in listed2)

        # Cleanup: delete moment
        requests.delete(f"{API}/moments/{mid}", headers=_h(mei_token), timeout=10)

    def test_bookmark_missing_moment_404(self, mei_token):
        r = requests.post(f"{API}/moments/does-not-exist/bookmark", headers=_h(mei_token), timeout=10)
        assert r.status_code == 404


# ── BACKEND 4 — Study rooms + Pomodoro ─────────────────────────────────────
def _clear_host_quota(email: str) -> None:
    """Clear host_usage on the given demo user via a direct mongo shell.
    Falls back to no-op — quota check will surface via 403."""
    try:
        import subprocess
        subprocess.run(
            ["mongosh", "linguaconnect", "--quiet", "--eval",
             f'db.users.updateOne({{email:"{email}"}}, {{$unset:{{host_usage:1}}}})'],
            check=False, timeout=10,
        )
    except Exception:
        pass


class TestStudyRoom:
    room_id: str | None = None

    def test_create_study_room(self, mei_token):
        _clear_host_quota(MEI[0])
        body = {
            "title": f"TEST_it16 study {uuid.uuid4().hex[:6]}",
            "language": "en",
            "mode": "study",
            "is_private": True,
            "background": 1,
        }
        r = requests.post(f"{API}/rooms", json=body, headers=_h(mei_token), timeout=15)
        assert r.status_code == 201, f"{r.status_code} {r.text}"
        d = r.json()
        assert d["mode"] == "study"
        p = d["pomodoro"]
        assert p["phase"] == "focus" and p["focus_min"] == 25 and p["break_min"] == 5
        assert p["running"] is False
        TestStudyRoom.room_id = d["id"]

    def test_pomodoro_start_skip_reset_host(self, mei_token):
        rid = TestStudyRoom.room_id
        assert rid, "room not created"

        r = requests.post(f"{API}/rooms/{rid}/pomodoro",
                          json={"action": "start"}, headers=_h(mei_token), timeout=10)
        assert r.status_code == 200
        p = r.json()["pomodoro"]
        assert p["running"] is True and p["phase"] == "focus"

        r = requests.post(f"{API}/rooms/{rid}/pomodoro",
                          json={"action": "skip"}, headers=_h(mei_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["pomodoro"]["phase"] == "break"

        r = requests.post(f"{API}/rooms/{rid}/pomodoro",
                          json={"action": "reset"}, headers=_h(mei_token), timeout=10)
        assert r.status_code == 200
        p = r.json()["pomodoro"]
        assert p["phase"] == "focus" and p["running"] is False
        assert p["remaining_sec"] == 25 * 60

    def test_pomodoro_non_host_403(self, diego_token):
        rid = TestStudyRoom.room_id
        # Study room was private — non-host still shouldn't control the timer
        # even if they somehow have the id.
        r = requests.post(f"{API}/rooms/{rid}/pomodoro",
                          json={"action": "start"}, headers=_h(diego_token), timeout=10)
        assert r.status_code == 403

    def test_cleanup_end_room(self, mei_token):
        rid = TestStudyRoom.room_id
        if rid:
            requests.post(f"{API}/rooms/{rid}/end", headers=_h(mei_token), timeout=10)


# ── BACKEND 5 — Admin hardening ────────────────────────────────────────────
class TestAdminHardening:
    def test_admin_token_kind_and_ver(self, admin_token):
        import jwt
        secret = "lingua-connect-super-secret-jwt-key-2025"
        payload = jwt.decode(admin_token, secret, algorithms=["HS256"])
        assert payload.get("kind") == "admin"
        assert "ver" in payload

    def test_admin_stats(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        for k in ("total_users", "live_rooms"):
            assert k in r.json()

    def test_regular_user_forbidden(self, mei_token):
        r = requests.get(f"{API}/admin/stats", headers=_h(mei_token), timeout=10)
        assert r.status_code == 403

    def test_audit_records_ban_action(self, admin_token, diego_token):
        # Grab diego's id from admin/users search
        users = requests.get(f"{API}/admin/users?search=diego", headers=_h(admin_token), timeout=10).json()
        assert users
        diego_id = users[0]["id"]

        # Ban then unban → 2 audit rows
        r1 = requests.post(f"{API}/admin/users/{diego_id}/ban", headers=_h(admin_token), timeout=10)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/admin/users/{diego_id}/ban", headers=_h(admin_token), timeout=10)
        assert r2.status_code == 200

        audit = requests.get(f"{API}/admin/audit", headers=_h(admin_token), timeout=10).json()
        actions = [a["action"] for a in audit[:10]]
        assert "unban_user" in actions or "ban_user" in actions

    def test_revoke_sessions_invalidates_token(self):
        # Fresh admin login (so revoke doesn't affect the module-scoped token used
        # by other tests running in this same session).
        tok = _login(*ADMIN)
        r = requests.get(f"{API}/admin/stats", headers=_h(tok), timeout=10)
        assert r.status_code == 200
        r2 = requests.post(f"{API}/admin/security/revoke-sessions", headers=_h(tok), timeout=10)
        assert r2.status_code == 200
        # Same token → next admin call 401
        r3 = requests.get(f"{API}/admin/stats", headers=_h(tok), timeout=10)
        assert r3.status_code == 401
        assert "revoked" in r3.text.lower() or "session" in r3.text.lower()

        # Fresh re-login should work
        tok2 = _login(*ADMIN)
        r4 = requests.get(f"{API}/admin/stats", headers=_h(tok2), timeout=10)
        assert r4.status_code == 200
