#!/usr/bin/env python3
"""
Backend test for in_voice_room presence fields
Tests that when a user is in a live voice room, their in_voice_room field appears in:
1. GET /api/users/{user_id}
2. GET /api/moments (author.in_voice_room)
3. GET /api/moments/{id} (author.in_voice_room)
4. GET /api/chats (partner.in_voice_room)
And that it disappears when the room ends.
"""

import requests
import sys

# Backend URL from frontend/.env
BASE_URL = "https://988fbec0-1b36-4d86-8489-4fcbf4ba4381.preview.emergentagent.com/api"

# Test credentials
MEI_EMAIL = "mei@demo.com"
MEI_PASSWORD = "Demo1234!"
DIEGO_EMAIL = "diego@demo.com"
DIEGO_PASSWORD = "Demo1234!"

def login(email, password):
    """Login and return JWT token and user_id"""
    print(f"🔐 Logging in as {email}...")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code} {response.text}")
        sys.exit(1)
    
    data = response.json()
    token = data.get("token")
    user_id = data.get("user", {}).get("id")
    
    if not token or not user_id:
        print(f"❌ Missing token or user_id in login response: {data}")
        sys.exit(1)
    
    print(f"✅ Login successful, user_id: {user_id}")
    return token, user_id

def test_in_voice_room_presence():
    """Test in_voice_room presence fields"""
    print("\n" + "="*80)
    print("TESTING: in_voice_room Presence Fields")
    print("="*80 + "\n")
    
    # Login both users
    mei_token, mei_id = login(MEI_EMAIL, MEI_PASSWORD)
    diego_token, diego_id = login(DIEGO_EMAIL, DIEGO_PASSWORD)
    
    mei_headers = {"Authorization": f"Bearer {mei_token}"}
    diego_headers = {"Authorization": f"Bearer {diego_token}"}
    
    # SETUP: First, leave/end any existing live rooms mei is in
    print("\n📋 SETUP: Checking for existing live rooms...")
    response = requests.get(f"{BASE_URL}/rooms", headers=mei_headers)
    if response.status_code == 200:
        rooms = response.json()
        for room in rooms:
            if room.get("is_live"):
                room_id_to_clean = room['id']
                # If mei is the host, end the room
                if room.get("host", {}).get("id") == mei_id:
                    print(f"   Ending room (mei is host): {room_id_to_clean}")
                    requests.post(f"{BASE_URL}/rooms/{room_id_to_clean}/end", headers=mei_headers)
                else:
                    # If mei is just a member, leave the room
                    print(f"   Leaving room (mei is member): {room_id_to_clean}")
                    requests.post(f"{BASE_URL}/rooms/{room_id_to_clean}/leave", headers=mei_headers)
    
    # SETUP: Create a room as mei
    print("\n📋 SETUP: Creating room as mei...")
    response = requests.post(
        f"{BASE_URL}/rooms",
        headers=mei_headers,
        json={
            "title": "presence check",
            "language": "en"
        }
    )
    
    if response.status_code != 201:
        print(f"❌ Room creation failed: {response.status_code} {response.text}")
        return False
    
    room_data = response.json()
    room_id = room_data.get("id")
    print(f"✅ Room created: {room_id}")
    print(f"   Room title: {room_data.get('title')}")
    print(f"   Room language: {room_data.get('language')}")
    
    # TEST 1: As diego, GET /api/users/{mei_id} → in_voice_room present
    print(f"\n🧪 TEST 1: GET /api/users/{mei_id} as diego → verify in_voice_room")
    response = requests.get(f"{BASE_URL}/users/{mei_id}", headers=diego_headers)
    
    if response.status_code != 200:
        print(f"❌ GET /api/users/{mei_id} failed: {response.status_code} {response.text}")
        return False
    
    user_data = response.json()
    
    if "in_voice_room" not in user_data:
        print(f"❌ FAILED: in_voice_room field missing from user response")
        print(f"   Response keys: {list(user_data.keys())}")
        return False
    
    in_voice_room = user_data["in_voice_room"]
    
    # Verify all required fields
    if in_voice_room.get("room_id") != room_id:
        print(f"❌ FAILED: room_id mismatch. Expected: {room_id}, Got: {in_voice_room.get('room_id')}")
        return False
    
    if in_voice_room.get("title") != "presence check":
        print(f"❌ FAILED: title mismatch. Expected: 'presence check', Got: {in_voice_room.get('title')}")
        return False
    
    if in_voice_room.get("name") != "presence check":
        print(f"❌ FAILED: name mismatch. Expected: 'presence check', Got: {in_voice_room.get('name')}")
        return False
    
    if in_voice_room.get("language") != "en":
        print(f"❌ FAILED: language mismatch. Expected: 'en', Got: {in_voice_room.get('language')}")
        return False
    
    print(f"✅ PASSED: in_voice_room present with correct fields")
    print(f"   room_id: {in_voice_room.get('room_id')}")
    print(f"   title: {in_voice_room.get('title')}")
    print(f"   name: {in_voice_room.get('name')}")
    print(f"   language: {in_voice_room.get('language')}")
    
    # TEST 2: Check if mei has existing moments, if not create one
    print(f"\n🧪 TEST 2: GET /api/moments as diego → verify mei's moments have in_voice_room")
    response = requests.get(f"{BASE_URL}/moments", headers=diego_headers)
    
    if response.status_code != 200:
        print(f"❌ GET /api/moments failed: {response.status_code} {response.text}")
        return False
    
    moments = response.json()
    mei_moments = [m for m in moments if m.get("author", {}).get("id") == mei_id]
    
    if not mei_moments:
        print(f"⚠️  No existing moments from mei, creating one...")
        response = requests.post(
            f"{BASE_URL}/moments",
            headers=mei_headers,
            json={"text": "presence moment"}
        )
        if response.status_code != 201:
            print(f"❌ Failed to create moment: {response.status_code} {response.text}")
            return False
        
        moment_id = response.json()["id"]
        print(f"✅ Created moment: {moment_id}")
        
        # Fetch moments again
        response = requests.get(f"{BASE_URL}/moments", headers=diego_headers)
        moments = response.json()
        mei_moments = [m for m in moments if m.get("author", {}).get("id") == mei_id]
    
    if not mei_moments:
        print(f"❌ FAILED: Still no moments from mei after creation")
        return False
    
    # Check first mei moment for in_voice_room
    mei_moment = mei_moments[0]
    moment_id = mei_moment["id"]
    
    if "author" not in mei_moment:
        print(f"❌ FAILED: author field missing from moment")
        return False
    
    if "in_voice_room" not in mei_moment["author"]:
        print(f"❌ FAILED: in_voice_room field missing from moment author")
        print(f"   Author keys: {list(mei_moment['author'].keys())}")
        return False
    
    moment_in_voice_room = mei_moment["author"]["in_voice_room"]
    
    if moment_in_voice_room.get("room_id") != room_id:
        print(f"❌ FAILED: room_id mismatch in moment. Expected: {room_id}, Got: {moment_in_voice_room.get('room_id')}")
        return False
    
    print(f"✅ PASSED: moment author has in_voice_room with room_id: {room_id}")
    
    # TEST 3: GET /api/moments/{moment_id} detail → in_voice_room present
    print(f"\n🧪 TEST 3: GET /api/moments/{moment_id} as diego → verify in_voice_room in detail")
    response = requests.get(f"{BASE_URL}/moments/{moment_id}", headers=diego_headers)
    
    if response.status_code != 200:
        print(f"❌ GET /api/moments/{moment_id} failed: {response.status_code} {response.text}")
        return False
    
    moment_detail = response.json()
    
    if "author" not in moment_detail or "in_voice_room" not in moment_detail["author"]:
        print(f"❌ FAILED: in_voice_room missing from moment detail author")
        return False
    
    detail_in_voice_room = moment_detail["author"]["in_voice_room"]
    
    if detail_in_voice_room.get("room_id") != room_id:
        print(f"❌ FAILED: room_id mismatch in moment detail. Expected: {room_id}, Got: {detail_in_voice_room.get('room_id')}")
        return False
    
    print(f"✅ PASSED: moment detail author has in_voice_room with room_id: {room_id}")
    
    # TEST 4: End room as mei → in_voice_room becomes null
    print(f"\n🧪 TEST 4: POST /api/rooms/{room_id}/end as mei → end room")
    response = requests.post(f"{BASE_URL}/rooms/{room_id}/end", headers=mei_headers)
    
    if response.status_code != 200:
        print(f"❌ Room end failed: {response.status_code} {response.text}")
        return False
    
    print(f"✅ Room ended successfully")
    
    # Verify in_voice_room is now absent/null
    print(f"\n🧪 TEST 4b: GET /api/users/{mei_id} as diego → verify in_voice_room absent")
    response = requests.get(f"{BASE_URL}/users/{mei_id}", headers=diego_headers)
    
    if response.status_code != 200:
        print(f"❌ GET /api/users/{mei_id} failed: {response.status_code} {response.text}")
        return False
    
    user_data = response.json()
    
    if "in_voice_room" in user_data and user_data["in_voice_room"] is not None:
        print(f"❌ FAILED: in_voice_room should be absent/null after room ended")
        print(f"   Got: {user_data['in_voice_room']}")
        return False
    
    print(f"✅ PASSED: in_voice_room is absent/null after room ended")
    
    # TEST 5: REGRESSION - GET /api/chats with in_voice_room
    print(f"\n🧪 TEST 5: REGRESSION - GET /api/chats as diego → verify partner in_voice_room")
    
    # First, check if conversation exists between mei and diego
    response = requests.get(f"{BASE_URL}/chats", headers=diego_headers)
    
    if response.status_code != 200:
        print(f"❌ GET /api/chats failed: {response.status_code} {response.text}")
        return False
    
    chats = response.json()
    mei_chat = None
    
    for chat in chats:
        if chat.get("partner", {}).get("id") == mei_id:
            mei_chat = chat
            break
    
    if not mei_chat:
        print(f"⚠️  No conversation with mei exists, creating one...")
        response = requests.post(
            f"{BASE_URL}/chats",
            headers=diego_headers,
            json={"partner_id": mei_id}
        )
        if response.status_code != 201:
            print(f"❌ Failed to create conversation: {response.status_code} {response.text}")
            return False
        
        print(f"✅ Created conversation with mei")
    
    # Create a NEW live room as mei
    print(f"\n   Creating NEW live room as mei for regression test...")
    response = requests.post(
        f"{BASE_URL}/rooms",
        headers=mei_headers,
        json={
            "title": "regression test room",
            "language": "en"
        }
    )
    
    if response.status_code != 201:
        print(f"❌ Room creation failed: {response.status_code} {response.text}")
        return False
    
    new_room_id = response.json()["id"]
    new_room_title = response.json()["title"]
    print(f"✅ New room created: {new_room_id}, title: {new_room_title}")
    
    # Now GET /api/chats as diego and verify partner has in_voice_room
    response = requests.get(f"{BASE_URL}/chats", headers=diego_headers)
    
    if response.status_code != 200:
        print(f"❌ GET /api/chats failed: {response.status_code} {response.text}")
        return False
    
    chats = response.json()
    mei_chat = None
    
    for chat in chats:
        if chat.get("partner", {}).get("id") == mei_id:
            mei_chat = chat
            break
    
    if not mei_chat:
        print(f"❌ FAILED: Conversation with mei not found in chats")
        return False
    
    partner = mei_chat.get("partner")
    
    if not partner:
        print(f"❌ FAILED: partner field missing from chat")
        return False
    
    if "in_voice_room" not in partner:
        print(f"❌ FAILED: in_voice_room missing from chat partner")
        print(f"   Partner keys: {list(partner.keys())}")
        return False
    
    chat_in_voice_room = partner["in_voice_room"]
    
    if chat_in_voice_room.get("room_id") != new_room_id:
        print(f"❌ FAILED: room_id mismatch in chat. Expected: {new_room_id}, Got: {chat_in_voice_room.get('room_id')}")
        return False
    
    if chat_in_voice_room.get("title") != new_room_title and chat_in_voice_room.get("name") != new_room_title:
        print(f"❌ FAILED: title/name mismatch in chat. Expected: {new_room_title}, Got title: {chat_in_voice_room.get('title')}, name: {chat_in_voice_room.get('name')}")
        return False
    
    print(f"✅ PASSED: chat partner has in_voice_room with correct room_id and title")
    
    # Cleanup: End the new room
    print(f"\n   Cleanup: Ending new room...")
    response = requests.post(f"{BASE_URL}/rooms/{new_room_id}/end", headers=mei_headers)
    
    if response.status_code == 200:
        print(f"✅ Cleanup successful")
    else:
        print(f"⚠️  Cleanup warning: {response.status_code}")
    
    return True

if __name__ == "__main__":
    try:
        success = test_in_voice_room_presence()
        
        if success:
            print("\n" + "="*80)
            print("✅ ALL TESTS PASSED")
            print("="*80)
            sys.exit(0)
        else:
            print("\n" + "="*80)
            print("❌ TESTS FAILED")
            print("="*80)
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
