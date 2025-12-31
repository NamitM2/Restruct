"""
API key management for persistent authentication.
"""

import secrets
import hashlib
from datetime import datetime
from typing import Optional


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.

    Returns:
        (full_key, key_hash, key_prefix)
        - full_key: The complete key to show user (only shown once)
        - key_hash: SHA-256 hash to store in database
        - key_prefix: First 8 chars for display (e.g., "rst_abc...")
    """
    random_part = secrets.token_urlsafe(32)
    full_key = f"rst_{random_part}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    key_prefix = full_key[:12]

    return full_key, key_hash, key_prefix


def hash_api_key(api_key: str) -> str:
    """Hash an API key for comparison."""
    return hashlib.sha256(api_key.encode()).hexdigest()


async def create_api_key(supabase, user_id: str, name: Optional[str] = None, expires_at: Optional[str] = None) -> dict:
    """
    Create a new API key for a user.

    Args:
        supabase: Supabase client
        user_id: User ID
        name: Optional name for the key
        expires_at: Optional expiration timestamp (ISO format)

    Returns:
        dict with 'key' (full key, show once) and 'key_prefix' (for display)
    """
    import asyncio

    full_key, key_hash, key_prefix = generate_api_key()

    payload = {
        "user_id": user_id,
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "name": name,
        "is_active": True
    }

    if expires_at:
        payload["expires_at"] = expires_at

    def _insert():
        return supabase.table("api_keys").insert(payload).execute()

    result = await asyncio.to_thread(_insert)

    if not result.data:
        raise Exception("Failed to create API key - no data returned")

    return {
        "id": result.data[0]["id"],
        "key": full_key,
        "key_prefix": key_prefix,
        "name": name,
        "expires_at": expires_at,
        "created_at": result.data[0]["created_at"]
    }


async def validate_api_key(supabase, api_key: str) -> Optional[dict]:
    """
    Validate an API key and return user info if valid.

    Returns:
        User dict with id, email, api_key_id, and rate limits if valid, None if invalid or expired
    """
    import asyncio

    key_hash = hash_api_key(api_key)

    def _query():
        return supabase.table("api_keys").select(
            "id, user_id, is_active, expires_at, rate_limit_rpm, rate_limit_rph, rate_limit_rpd"
        ).eq("key_hash", key_hash).eq("is_active", True).execute()

    result = await asyncio.to_thread(_query)

    if not result.data:
        return None

    api_key_record = result.data[0]

    # Check if key is expired
    if api_key_record.get("expires_at"):
        from datetime import datetime, timezone
        expires_at = datetime.fromisoformat(api_key_record["expires_at"].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > expires_at:
            return None  # Key is expired

    user_id = api_key_record["user_id"]
    key_id = api_key_record["id"]

    # Update last_used_at (fire and forget)
    try:
        def _update():
            return supabase.table("api_keys").update({
                "last_used_at": datetime.utcnow().isoformat()
            }).eq("key_hash", key_hash).execute()

        await asyncio.to_thread(_update)
    except:
        pass  # Don't fail auth if update fails

    # Return user info with API key ID and rate limits
    return {
        "id": user_id,
        "email": None,  # Email not needed for API key auth
        "api_key_id": key_id,
        "rate_limit_rpm": api_key_record.get("rate_limit_rpm"),
        "rate_limit_rph": api_key_record.get("rate_limit_rph"),
        "rate_limit_rpd": api_key_record.get("rate_limit_rpd")
    }


async def list_api_keys(supabase, user_id: str) -> list[dict]:
    """List all API keys for a user (without full keys)."""
    import asyncio

    def _query():
        return supabase.table("api_keys").select(
            "id, key_prefix, name, created_at, last_used_at, is_active, expires_at"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()

    result = await asyncio.to_thread(_query)
    return result.data


async def revoke_api_key(supabase, user_id: str, key_id: str) -> bool:
    """Revoke (deactivate) an API key."""
    import asyncio

    def _update():
        return supabase.table("api_keys").update({
            "is_active": False
        }).eq("id", key_id).eq("user_id", user_id).execute()

    result = await asyncio.to_thread(_update)
    return len(result.data) > 0


async def delete_api_key(supabase, user_id: str, key_id: str) -> bool:
    """Permanently delete an API key."""
    import asyncio

    def _delete():
        return supabase.table("api_keys").delete().eq(
            "id", key_id
        ).eq("user_id", user_id).execute()

    result = await asyncio.to_thread(_delete)
    return len(result.data) > 0
