import sys
import os
sys.path.append(os.getcwd())
from backend_code.app import supabase
import asyncio

async def test_anon():
    try:
        # Check if method exists
        if hasattr(supabase.auth, 'sign_in_anonymously'):
            print("sign_in_anonymously exists")
            res = supabase.auth.sign_in_anonymously()
            print("Anon login success:", res)
        else:
            print("sign_in_anonymously NOT found")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_anon())
