import requests
import sys

# BASE_URL = "http://localhost:8000" # User's local server address - assuming default
BASE_URL = "http://127.0.0.1:8000"

def test_guest_login():
    print(f"Testing guest login at {BASE_URL}/auth/guest...")
    try:
        response = requests.post(f"{BASE_URL}/auth/guest")
        
        if response.status_code != 200:
            print(f"FAILED: Status code {response.status_code}")
            print(f"Response: {response.text}")
            sys.exit(1)
            
        data = response.json()
        
        if not data.get("success"):
            print("FAILED: Success flag is false")
            print(f"Response: {data}")
            sys.exit(1)
            
        user = data.get("user", {})
        if not user.get("is_guest"):
            print("FAILED: User is not marked as guest")
            print(f"User data: {user}")
            sys.exit(1)
            
        session = data.get("session", {})
        if not session.get("access_token"):
            print("FAILED: No access token returned")
            sys.exit(1)
            
        print("SUCCESS: Guest login worked as expected!")
        print(f"Created guest user: {user.get('email')}")
        
    except requests.exceptions.ConnectionError:
        print("FAILED: Could not connect to server. Is it running?")
        sys.exit(1)
    except Exception as e:
        print(f"FAILED: An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_guest_login()
