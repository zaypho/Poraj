"""Iteration 17 — VIP teach-language policy on PUT /api/users/me.

Covers:
- Non-VIP user: teach_languages update is cleared to [].
- VIP user: >2 teach_languages → 422 (pydantic max_length=2).
- VIP user: 2 valid teach_languages → saved.
- VIP user: native language appears in submitted teach_languages → filtered server-side.
- VIP user: changing native to a language currently in teach_languages → removed from teach_languages.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"
BASE_URL = BASE_URL.rstrip("/") + "/api"

VIP_EMAIL = "mei@demo.com"
NON_VIP_EMAIL = "diego@demo.com"
PASSWORD = "Demo1234!"


def _login(email: str, password: str = PASSWORD) -> str:
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _headers(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _get_me(tok: str) -> dict:
    r = requests.get(f"{BASE_URL}/auth/me", headers=_headers(tok), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _put_me(tok: str, body: dict) -> requests.Response:
    return requests.put(f"{BASE_URL}/users/me", headers=_headers(tok), json=body, timeout=30)


@pytest.fixture(scope="module")
def vip_token() -> str:
    return _login(VIP_EMAIL)


@pytest.fixture(scope="module")
def non_vip_token() -> str:
    return _login(NON_VIP_EMAIL)


@pytest.fixture(scope="module", autouse=True)
def _snapshot_and_restore(vip_token, non_vip_token):
    """Snapshot VIP + non-VIP user state, run tests, restore afterwards."""
    vip_before = _get_me(vip_token)
    non_before = _get_me(non_vip_token)
    yield
    # Restore
    _put_me(vip_token, {
        "native_language": vip_before.get("native_language") or "zh",
        "teach_languages": vip_before.get("teach_languages") or [],
    })
    _put_me(non_vip_token, {
        "teach_languages": non_before.get("teach_languages") or [],
    })


# ---------- VIP checks ----------

class TestVipUser:
    def test_vip_user_is_vip(self, vip_token):
        me = _get_me(vip_token)
        assert me.get("is_vip") is True, "mei@demo.com is expected to be VIP"

    def test_vip_too_many_teach_langs_422(self, vip_token):
        # Ensure native is 'zh' first so we know the filter behavior
        r0 = _put_me(vip_token, {"native_language": "zh"})
        assert r0.status_code == 200
        r = _put_me(vip_token, {"teach_languages": ["en", "es", "fr"]})
        assert r.status_code == 422, f"expected 422 pydantic max_length, got {r.status_code}: {r.text}"

    def test_vip_two_valid_teach_langs_saved(self, vip_token):
        r = _put_me(vip_token, {"native_language": "zh", "teach_languages": ["en", "es"]})
        assert r.status_code == 200, r.text
        me = _get_me(vip_token)
        assert set(me.get("teach_languages") or []) == {"en", "es"}, me

    def test_vip_native_filtered_out_of_teach(self, vip_token):
        # Native zh + one other should result in [other] only (native filtered)
        _put_me(vip_token, {"native_language": "zh"})
        r = _put_me(vip_token, {"teach_languages": ["zh", "en"]})
        assert r.status_code == 200, r.text
        me = _get_me(vip_token)
        assert me.get("teach_languages") == ["en"], me

    def test_vip_change_native_removes_from_teach(self, vip_token):
        # Setup: native=zh, teach=[en, fr]
        r = _put_me(vip_token, {"native_language": "zh", "teach_languages": ["en", "fr"]})
        assert r.status_code == 200, r.text
        me = _get_me(vip_token)
        assert set(me.get("teach_languages") or []) == {"en", "fr"}
        # Now change native to 'en' — should drop from teach_languages
        r2 = _put_me(vip_token, {"native_language": "en"})
        assert r2.status_code == 200, r2.text
        me2 = _get_me(vip_token)
        assert me2.get("native_language") == "en"
        assert "en" not in (me2.get("teach_languages") or []), me2
        assert me2.get("teach_languages") == ["fr"], me2
        # Restore native
        _put_me(vip_token, {"native_language": "zh", "teach_languages": []})


# ---------- Non-VIP checks ----------

class TestNonVipUser:
    def test_non_vip_user_is_not_vip(self, non_vip_token):
        me = _get_me(non_vip_token)
        assert me.get("is_vip") is False or me.get("is_vip") is None, "diego@demo.com should not be VIP"

    def test_non_vip_teach_langs_cleared(self, non_vip_token):
        r = _put_me(non_vip_token, {"teach_languages": ["en", "fr"]})
        assert r.status_code == 200, r.text
        me = _get_me(non_vip_token)
        assert me.get("teach_languages") == [], me
