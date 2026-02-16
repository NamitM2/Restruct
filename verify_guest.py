import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

email = "Restructguest@gmail.com"
password = "Restruct"

print(f"Attempting to sign in as {email} with password '{password}'...")

try:
    response = supabase.auth.sign_in_with_password({
        "email": email,
        "password": password
    })
    
    if response.user:
        print("SUCCESS: Signed in!")
        print(f"User ID: {response.user.id}")
    else:
        print("FAILED: No user object returned (Response 200 but no user?)")

except Exception as e:
    print(f"ERROR: Sign in failed.")
    print(f"Exception Type: {type(e).__name__}")
    print(f"Details: {e}")
