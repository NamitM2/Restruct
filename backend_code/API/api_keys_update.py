"""
API key update functions
"""

from typing import Optional


async def update_api_key(supabase, user_id: str, key_id: str, name: Optional[str] = None) -> bool:
    """
    Update an API key's name.

    Args:
        supabase: Supabase client
        user_id: User ID (for authorization)
        key_id: API key ID
        name: New name for the key

    Returns:
        True if updated successfully
    """
    import asyncio

    payload = {}
    if name is not None:
        payload["name"] = name

    if not payload:
        return True  # Nothing to update

    def _update():
        return supabase.table("api_keys").update(payload).eq(
            "id", key_id
        ).eq("user_id", user_id).execute()

    result = await asyncio.to_thread(_update)
    return len(result.data) > 0
