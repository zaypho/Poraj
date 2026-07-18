#!/usr/bin/env python3
"""
Backend API Testing for Admin Control Endpoints (Pro + Premium)
Tests all admin-only endpoints for Pro sub-app and Premium VIP management
"""

import requests
import json
from typing import Dict, Any

# Base URL from frontend/.env
BASE_URL = "https://message-context-menu.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@lingua.app"
ADMIN_PASSWORD = "Admin1234!"
NON_ADMIN_EMAIL = "mei@demo.com"
NON_ADMIN_PASSWORD = "Demo1234!"

# Global tokens
admin_token = None
non_admin_token = None
created_tutor_id = None


def login(email: str, password: str) -> str:
    """Login and return JWT token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        return response.json()["token"]
    else:
        raise Exception(f"Login failed for {email}: {response.status_code} {response.text}")


def test_auth_setup():
    """Setup: Login as admin and non-admin users"""
    global admin_token, non_admin_token
    
    print("\n=== AUTH SETUP ===")
    
    # Login as admin
    try:
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        print(f"✅ Admin login successful")
    except Exception as e:
        print(f"❌ Admin login failed: {e}")
        return False
    
    # Login as non-admin
    try:
        non_admin_token = login(NON_ADMIN_EMAIL, NON_ADMIN_PASSWORD)
        print(f"✅ Non-admin login successful")
    except Exception as e:
        print(f"❌ Non-admin login failed: {e}")
        return False
    
    return True


def test_pro_stats():
    """Test GET /api/admin/pro/stats"""
    print("\n=== TEST 1: GET /api/admin/pro/stats ===")
    
    # Test with admin token
    response = requests.get(
        f"{BASE_URL}/admin/pro/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        required_fields = ["tutors", "online_tutors", "students", "total_sessions", 
                          "active_sessions", "completed_sessions", "minutes_taught"]
        
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            print(f"❌ Missing fields: {missing_fields}")
            return False
        
        # Verify all are integers
        for field in required_fields:
            if not isinstance(data[field], int):
                print(f"❌ Field '{field}' is not an integer: {type(data[field])}")
                return False
        
        print(f"✅ Pro stats returned correctly: {data}")
        return True
    else:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False


def test_pro_tutors_list():
    """Test GET /api/admin/pro/tutors"""
    print("\n=== TEST 2: GET /api/admin/pro/tutors ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/pro/tutors",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        tutors = response.json()
        
        if not isinstance(tutors, list):
            print(f"❌ Response is not a list: {type(tutors)}")
            return False
        
        if len(tutors) == 0:
            print("⚠️  No tutors found (empty list)")
            return True
        
        # Verify first tutor has required fields
        tutor = tutors[0]
        required_fields = ["id", "name", "is_online", "featured", "rating", "specialties"]
        missing_fields = [f for f in required_fields if f not in tutor]
        
        if missing_fields:
            print(f"❌ Tutor missing fields: {missing_fields}")
            return False
        
        print(f"✅ Tutors list returned correctly ({len(tutors)} tutors)")
        print(f"   Sample tutor: {tutor['name']}, rating={tutor['rating']}, featured={tutor['featured']}")
        return True
    else:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False


def test_pro_tutors_create():
    """Test POST /api/admin/pro/tutors"""
    global created_tutor_id
    
    print("\n=== TEST 3: POST /api/admin/pro/tutors ===")
    
    tutor_data = {
        "name": "Test Tutor QA",
        "native_accent": "American",
        "teaches": ["en"],
        "specialties": ["Conversation"],
        "hourly_rate": 16,
        "avatar_url": None
    }
    
    response = requests.post(
        f"{BASE_URL}/admin/pro/tutors",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=tutor_data
    )
    
    if response.status_code == 201:
        tutor = response.json()
        
        # Verify required fields
        if "id" not in tutor:
            print(f"❌ Created tutor missing 'id' field")
            return False
        
        if tutor.get("role") != "tutor":
            print(f"❌ Created tutor has wrong role: {tutor.get('role')}")
            return False
        
        if tutor.get("name") != "Test Tutor QA":
            print(f"❌ Created tutor has wrong name: {tutor.get('name')}")
            return False
        
        created_tutor_id = tutor["id"]
        print(f"✅ Tutor created successfully: id={created_tutor_id}, name={tutor['name']}")
        return True
    else:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False


def test_pro_tutors_update():
    """Test PUT /api/admin/pro/tutors/{id}"""
    print("\n=== TEST 4: PUT /api/admin/pro/tutors/{id} ===")
    
    if not created_tutor_id:
        print("❌ No tutor ID available (create test must run first)")
        return False
    
    # Test 4a: Toggle offline
    print("  4a: Toggle is_online to false")
    response = requests.put(
        f"{BASE_URL}/admin/pro/tutors/{created_tutor_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_online": False}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False
    
    tutor = response.json()
    if tutor.get("is_online") != False:
        print(f"❌ is_online not updated: {tutor.get('is_online')}")
        return False
    
    print(f"✅ is_online toggled to false")
    
    # Test 4b: Set featured
    print("  4b: Set featured to true")
    response = requests.put(
        f"{BASE_URL}/admin/pro/tutors/{created_tutor_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"featured": True}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False
    
    tutor = response.json()
    if tutor.get("featured") != True:
        print(f"❌ featured not updated: {tutor.get('featured')}")
        return False
    
    print(f"✅ featured set to true")
    
    # Test 4c: Update rating
    print("  4c: Update rating to 4.5")
    response = requests.put(
        f"{BASE_URL}/admin/pro/tutors/{created_tutor_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"rating": 4.5}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False
    
    tutor = response.json()
    if tutor.get("rating") != 4.5:
        print(f"❌ rating not updated: {tutor.get('rating')}")
        return False
    
    print(f"✅ rating updated to 4.5")
    
    # Test 4d: Update teaches (should also update languages)
    print("  4d: Update teaches to ['es']")
    response = requests.put(
        f"{BASE_URL}/admin/pro/tutors/{created_tutor_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"teaches": ["es"]}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False
    
    tutor = response.json()
    if "es" not in tutor.get("languages", []):
        print(f"❌ languages not updated: {tutor.get('languages')}")
        return False
    
    print(f"✅ teaches/languages updated to ['es']")
    
    # Test 4e: Invalid ID should return 404
    print("  4e: Invalid tutor ID should return 404")
    response = requests.put(
        f"{BASE_URL}/admin/pro/tutors/invalid-id-12345",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"rating": 5.0}
    )
    
    if response.status_code != 404:
        print(f"❌ Expected 404, got {response.status_code}")
        return False
    
    print(f"✅ Invalid ID correctly returns 404")
    
    return True


def test_pro_tutors_delete():
    """Test DELETE /api/admin/pro/tutors/{id}"""
    print("\n=== TEST 5: DELETE /api/admin/pro/tutors/{id} ===")
    
    if not created_tutor_id:
        print("❌ No tutor ID available (create test must run first)")
        return False
    
    # Test 5a: Delete the created tutor
    print(f"  5a: Delete tutor {created_tutor_id}")
    response = requests.delete(
        f"{BASE_URL}/admin/pro/tutors/{created_tutor_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False
    
    data = response.json()
    if data.get("ok") != True:
        print(f"❌ Response missing 'ok: true': {data}")
        return False
    
    print(f"✅ Tutor deleted successfully")
    
    # Test 5b: Deleting again should return 404
    print(f"  5b: Deleting again should return 404")
    response = requests.delete(
        f"{BASE_URL}/admin/pro/tutors/{created_tutor_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 404:
        print(f"❌ Expected 404, got {response.status_code}")
        return False
    
    print(f"✅ Second delete correctly returns 404")
    
    # Test 5c: Invalid ID should return 404
    print(f"  5c: Invalid ID should return 404")
    response = requests.delete(
        f"{BASE_URL}/admin/pro/tutors/invalid-id-99999",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 404:
        print(f"❌ Expected 404, got {response.status_code}")
        return False
    
    print(f"✅ Invalid ID correctly returns 404")
    
    return True


def test_pro_sessions_list():
    """Test GET /api/admin/pro/sessions"""
    print("\n=== TEST 6: GET /api/admin/pro/sessions ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/pro/sessions",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        sessions = response.json()
        
        if not isinstance(sessions, list):
            print(f"❌ Response is not a list: {type(sessions)}")
            return False
        
        if len(sessions) == 0:
            print("⚠️  No sessions found (empty list)")
            return True
        
        # Verify first session has required fields
        session = sessions[0]
        required_fields = ["id", "status", "student", "tutor", "call_duration"]
        missing_fields = [f for f in required_fields if f not in session]
        
        if missing_fields:
            print(f"❌ Session missing fields: {missing_fields}")
            return False
        
        print(f"✅ Sessions list returned correctly ({len(sessions)} sessions)")
        print(f"   Sample session: id={session['id']}, status={session['status']}, duration={session['call_duration']}s")
        return True
    else:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False


def test_pro_sessions_end():
    """Test POST /api/admin/pro/sessions/{id}/end"""
    print("\n=== TEST 7: POST /api/admin/pro/sessions/{id}/end ===")
    
    # First, get list of sessions to find an active one
    response = requests.get(
        f"{BASE_URL}/admin/pro/sessions",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to get sessions list: {response.status_code}")
        return False
    
    sessions = response.json()
    
    if len(sessions) == 0:
        print("⚠️  No sessions available to test ending")
        return True
    
    # Try to find an active session, otherwise use any session
    session_id = None
    for session in sessions:
        if session.get("status") == "active":
            session_id = session["id"]
            print(f"  Found active session: {session_id}")
            break
    
    if not session_id:
        session_id = sessions[0]["id"]
        print(f"  No active session found, using first session: {session_id}")
    
    # Test 7a: End the session
    response = requests.post(
        f"{BASE_URL}/admin/pro/sessions/{session_id}/end",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        
        if data.get("ok") != True:
            print(f"❌ Response missing 'ok: true': {data}")
            return False
        
        if data.get("status") != "completed":
            print(f"❌ Status not 'completed': {data.get('status')}")
            return False
        
        print(f"✅ Session ended successfully: {data}")
    else:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False
    
    # Test 7b: Invalid session ID should return 404
    print("  7b: Invalid session ID should return 404")
    response = requests.post(
        f"{BASE_URL}/admin/pro/sessions/invalid-session-id/end",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code != 404:
        print(f"❌ Expected 404, got {response.status_code}")
        return False
    
    print(f"✅ Invalid session ID correctly returns 404")
    
    return True


def test_premium_stats():
    """Test GET /api/admin/premium/stats"""
    print("\n=== TEST 8: GET /api/admin/premium/stats ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/premium/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        data = response.json()
        required_fields = ["vip_users", "vip_weekly", "vip_monthly", "vip_lifetime"]
        
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            print(f"❌ Missing fields: {missing_fields}")
            return False
        
        # Verify all are integers
        for field in required_fields:
            if not isinstance(data[field], int):
                print(f"❌ Field '{field}' is not an integer: {type(data[field])}")
                return False
        
        print(f"✅ Premium stats returned correctly: {data}")
        return True
    else:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False


def test_premium_members():
    """Test GET /api/admin/premium/members"""
    print("\n=== TEST 9: GET /api/admin/premium/members ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/premium/members",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        members = response.json()
        
        if not isinstance(members, list):
            print(f"❌ Response is not a list: {type(members)}")
            return False
        
        if len(members) == 0:
            print("⚠️  No VIP members found (empty list)")
            return True
        
        # Verify first member has required fields
        member = members[0]
        required_fields = ["id", "name", "email", "vip_tier"]
        missing_fields = [f for f in required_fields if f not in member]
        
        if missing_fields:
            print(f"❌ Member missing fields: {missing_fields}")
            return False
        
        # Verify is_vip is true
        if not member.get("is_vip"):
            print(f"❌ Member is_vip is not true: {member.get('is_vip')}")
            return False
        
        print(f"✅ Premium members list returned correctly ({len(members)} members)")
        print(f"   Sample member: {member['name']} ({member['email']}), tier={member['vip_tier']}")
        return True
    else:
        print(f"❌ Failed with status {response.status_code}: {response.text}")
        return False


def test_authorization_non_admin():
    """Test authorization: non-admin should get 403"""
    print("\n=== TEST 10: Authorization - Non-admin should get 403 ===")
    
    response = requests.get(
        f"{BASE_URL}/admin/pro/stats",
        headers={"Authorization": f"Bearer {non_admin_token}"}
    )
    
    if response.status_code == 403:
        print(f"✅ Non-admin correctly rejected with 403")
        return True
    else:
        print(f"❌ Expected 403, got {response.status_code}: {response.text}")
        return False


def test_authorization_no_token():
    """Test authorization: no token should get 401 or 403"""
    print("\n=== TEST 11: Authorization - No token should get 401/403 ===")
    
    response = requests.get(f"{BASE_URL}/admin/pro/stats")
    
    if response.status_code in [401, 403]:
        print(f"✅ No token correctly rejected with {response.status_code}")
        return True
    else:
        print(f"❌ Expected 401/403, got {response.status_code}: {response.text}")
        return False


def main():
    """Run all tests"""
    print("=" * 70)
    print("ADMIN CONTROL ENDPOINTS TESTING - PRO + PREMIUM")
    print("=" * 70)
    
    # Setup authentication
    if not test_auth_setup():
        print("\n❌ AUTH SETUP FAILED - Cannot proceed with tests")
        return
    
    # Track results
    results = []
    
    # Run all tests
    tests = [
        ("GET /api/admin/pro/stats", test_pro_stats),
        ("GET /api/admin/pro/tutors", test_pro_tutors_list),
        ("POST /api/admin/pro/tutors", test_pro_tutors_create),
        ("PUT /api/admin/pro/tutors/{id}", test_pro_tutors_update),
        ("DELETE /api/admin/pro/tutors/{id}", test_pro_tutors_delete),
        ("GET /api/admin/pro/sessions", test_pro_sessions_list),
        ("POST /api/admin/pro/sessions/{id}/end", test_pro_sessions_end),
        ("GET /api/admin/premium/stats", test_premium_stats),
        ("GET /api/admin/premium/members", test_premium_members),
        ("Authorization - Non-admin 403", test_authorization_non_admin),
        ("Authorization - No token 401/403", test_authorization_no_token),
    ]
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test crashed: {e}")
            results.append((test_name, False))
    
    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")


if __name__ == "__main__":
    main()
