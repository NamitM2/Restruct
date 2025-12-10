"""
List all routing profiles for testing.
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Fetch all profiles
result = supabase.table("routing_profiles").select("*").execute()

print("\n=== All Routing Profiles ===")
print(f"Found {len(result.data)} profiles:\n")

for profile in result.data:
    print(f"  Name: {profile['name']}")
    print(f"  Slug: {profile['slug']}")
    print(f"  User: {profile['user_id'][:8]}...")
    print(f"  Created: {profile.get('created_at', 'N/A')}")
    # Check if there's a deleted flag or similar
    if 'deleted' in profile:
        print(f"  Deleted: {profile['deleted']}")
    if 'is_active' in profile:
        print(f"  Active: {profile['is_active']}")
    print()
