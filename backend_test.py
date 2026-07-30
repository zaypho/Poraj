#!/usr/bin/env python3
"""
Backend test for voice comments on moments (Round 36)
Tests POST /api/moments/{id}/comments with audio_base64
"""

import base64
import requests
import sys

# Backend URL from frontend/.env
BASE_URL = "https://988fbec0-1b36-4d86-8489-4fcbf4ba4381.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "mei@demo.com"
TEST_PASSWORD = "Demo1234!"

# Valid base64 audio (minimal WebM audio file)
VALID_AUDIO_BASE64 = "UklGRi4AAABXQVZF"

def login():
    """Login and return JWT token"""
    print(f"🔐 Logging in as {TEST_EMAIL}...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code} {response.text}")
        sys.exit(1)
    
    token = response.json().get("token")
    if not token:
        print(f"❌ No token in login response: {response.json()}")
        sys.exit(1)
    
    print(f"✅ Login successful, got token")
    return token

def test_voice_comments_on_moments():
    """Test voice comments on moments"""
    print("\n" + "="*80)
    print("TESTING: Voice Comments on Moments (Round 36)")
    print("="*80 + "\n")
    
    token = login()
    headers = {"Authorization": f"Bearer {token}"}
    
    # TEST 1: GET /api/moments → pick first moment id
    print("\n📋 TEST 1: GET /api/moments → pick first moment id")
    response = requests.get(f"{BASE_URL}/moments", headers=headers)
    if response.status_code != 200:
        print(f"❌ GET /api/moments failed: {response.status_code} {response.text}")
        return False
    
    moments = response.json()
    if not moments or len(moments) == 0:
        print("⚠️  No moments found, creating a test moment first...")
        # Create a test moment
        create_response = requests.post(
            f"{BASE_URL}/moments",
            headers=headers,
            json={"text": "Test moment for voice comments"}
        )
        if create_response.status_code != 201:
            print(f"❌ Failed to create test moment: {create_response.status_code}")
            return False
        moment_id = create_response.json()["id"]
        print(f"✅ Created test moment: {moment_id}")
    else:
        moment_id = moments[0]["id"]
        print(f"✅ Found moment: {moment_id}")
    
    # TEST 2: POST /api/moments/{id}/comments with audio_base64 (no text) → 201
    print(f"\n🎤 TEST 2: POST /api/moments/{moment_id}/comments with audio_base64 (no text)")
    response = requests.post(
        f"{BASE_URL}/moments/{moment_id}/comments",
        headers=headers,
        json={
            "audio_base64": VALID_AUDIO_BASE64,
            "audio_mime": "audio/webm",
            "audio_duration_ms": 2000
        }
    )
    
    if response.status_code != 201:
        print(f"❌ POST voice comment failed: {response.status_code} {response.text}")
        return False
    
    comment_data = response.json()
    print(f"✅ Voice comment created: {response.status_code}")
    
    # Verify response has audio_url starting with /api/audio/
    if "audio_url" not in comment_data:
        print(f"❌ Response missing audio_url field: {comment_data}")
        return False
    
    audio_url = comment_data["audio_url"]
    if not audio_url.startswith("/api/audio/"):
        print(f"❌ audio_url doesn't start with /api/audio/: {audio_url}")
        return False
    
    print(f"✅ audio_url starts with /api/audio/: {audio_url}")
    
    # Verify audio_duration_ms is present and correct
    if "audio_duration_ms" not in comment_data:
        print(f"❌ Response missing audio_duration_ms field: {comment_data}")
        return False
    
    if comment_data["audio_duration_ms"] != 2000:
        print(f"❌ audio_duration_ms is {comment_data['audio_duration_ms']}, expected 2000")
        return False
    
    print(f"✅ audio_duration_ms = 2000")
    
    comment_id = comment_data["id"]
    
    # TEST 3: GET the returned audio_url → returns bytes
    print(f"\n🔊 TEST 3: GET {audio_url} → returns bytes")
    # Remove /api prefix since BASE_URL already includes /api
    audio_path = audio_url.replace("/api/", "/")
    full_audio_url = f"{BASE_URL.replace('/api', '')}{audio_url}"
    
    response = requests.get(full_audio_url, headers=headers)
    if response.status_code != 200:
        print(f"❌ GET audio failed: {response.status_code} {response.text}")
        return False
    
    audio_bytes = response.content
    if len(audio_bytes) == 0:
        print(f"❌ Audio response is empty")
        return False
    
    print(f"✅ Audio retrieved: {len(audio_bytes)} bytes")
    
    # TEST 4: GET /api/moments/{id} → new comment appears with audio_url + audio_duration_ms
    print(f"\n📖 TEST 4: GET /api/moments/{moment_id} → verify comment appears")
    response = requests.get(f"{BASE_URL}/moments/{moment_id}", headers=headers)
    if response.status_code != 200:
        print(f"❌ GET moment failed: {response.status_code} {response.text}")
        return False
    
    moment_data = response.json()
    if "comments" not in moment_data:
        print(f"❌ Moment response missing comments field: {moment_data}")
        return False
    
    # Find our comment
    found_comment = None
    for comment in moment_data["comments"]:
        if comment["id"] == comment_id:
            found_comment = comment
            break
    
    if not found_comment:
        print(f"❌ Comment {comment_id} not found in moment comments")
        return False
    
    print(f"✅ Comment found in moment")
    
    # Verify audio_url and audio_duration_ms in comment
    if "audio_url" not in found_comment or not found_comment["audio_url"].startswith("/api/audio/"):
        print(f"❌ Comment missing or invalid audio_url: {found_comment}")
        return False
    
    if "audio_duration_ms" not in found_comment or found_comment["audio_duration_ms"] != 2000:
        print(f"❌ Comment missing or invalid audio_duration_ms: {found_comment}")
        return False
    
    print(f"✅ Comment has audio_url and audio_duration_ms=2000")
    
    # TEST 5: POST comment with neither text nor audio ({}) → 400
    print(f"\n❌ TEST 5: POST comment with neither text nor audio → expect 400")
    response = requests.post(
        f"{BASE_URL}/moments/{moment_id}/comments",
        headers=headers,
        json={}
    )
    
    if response.status_code != 400:
        print(f"❌ Expected 400, got {response.status_code}: {response.text}")
        return False
    
    print(f"✅ Correctly rejected empty comment with 400")
    
    # TEST 6: POST comment with bad audio_base64 → 400
    print(f"\n❌ TEST 6: POST comment with bad audio_base64 → expect 400")
    response = requests.post(
        f"{BASE_URL}/moments/{moment_id}/comments",
        headers=headers,
        json={
            "audio_base64": "!!!bad!!!",
            "audio_mime": "audio/webm",
            "audio_duration_ms": 1000
        }
    )
    
    if response.status_code != 400:
        print(f"❌ Expected 400, got {response.status_code}: {response.text}")
        return False
    
    print(f"✅ Correctly rejected invalid audio_base64 with 400")
    
    # TEST 7: Regression - POST normal text comment → 201 with audio_url null/absent
    print(f"\n📝 TEST 7: Regression - POST text comment → audio_url null/absent")
    response = requests.post(
        f"{BASE_URL}/moments/{moment_id}/comments",
        headers=headers,
        json={"text": "hello"}
    )
    
    if response.status_code != 201:
        print(f"❌ POST text comment failed: {response.status_code} {response.text}")
        return False
    
    text_comment = response.json()
    print(f"✅ Text comment created: {response.status_code}")
    
    # Verify audio_url is null or absent
    audio_url_value = text_comment.get("audio_url")
    if audio_url_value is not None:
        print(f"❌ Text comment has audio_url={audio_url_value}, expected null/absent")
        return False
    
    print(f"✅ Text comment has audio_url=null (correct)")
    
    # Verify audio_duration_ms is null or absent
    audio_duration_value = text_comment.get("audio_duration_ms")
    if audio_duration_value is not None:
        print(f"❌ Text comment has audio_duration_ms={audio_duration_value}, expected null/absent")
        return False
    
    print(f"✅ Text comment has audio_duration_ms=null (correct)")
    
    print("\n" + "="*80)
    print("✅ ALL TESTS PASSED (7/7)")
    print("="*80 + "\n")
    return True

if __name__ == "__main__":
    try:
        success = test_voice_comments_on_moments()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
