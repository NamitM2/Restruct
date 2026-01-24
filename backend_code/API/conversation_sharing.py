"""
Conversation sharing and collaboration management.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any


async def share_conversation(
    supabase,
    user_id: str,
    conversation_id: str,
    permission: str = "view",
    billing: str = "owner",
    expires_in: Optional[str] = None,
    max_participants: int = 10,
    participant_access_duration: str = "forever",
    participant_access_custom_hours: Optional[int] = None
) -> Dict[str, Any]:
    """
    Enable sharing for a conversation and generate share token.

    Args:
        supabase: Supabase client
        user_id: User ID (must be conversation owner)
        conversation_id: Conversation ID to share
        permission: Default permission level (view, chat)
        billing: Billing mode (owner, individual)
        expires_in: Expiration time (1h, 24h, 7d, 30d, or None for never)
        max_participants: Maximum number of participants (default: 10)
        participant_access_duration: How long participants can chat (1h, 24h, 7d, forever, custom)
        participant_access_custom_hours: For custom duration, number of hours

    Returns:
        dict with share_token and share_url
    """

    def _verify_and_share():
        # Verify ownership
        conv = supabase.table("conversations").select("id, user_id, is_shared, share_token").eq(
            "id", conversation_id
        ).eq("user_id", user_id).execute()

        if not conv.data:
            raise Exception("Conversation not found or access denied")

        # Calculate expiration
        expires_at = None
        if expires_in:
            now = datetime.now(timezone.utc)
            if expires_in == "1h":
                expires_at = now + timedelta(hours=1)
            elif expires_in == "24h":
                expires_at = now + timedelta(hours=24)
            elif expires_in == "7d":
                expires_at = now + timedelta(days=7)
            elif expires_in == "30d":
                expires_at = now + timedelta(days=30)

        # If already shared, return existing token (or regenerate if settings changed)
        if conv.data[0].get("is_shared") and conv.data[0].get("share_token"):
            return conv.data[0]

        # Generate share token
        token_result = supabase.rpc("generate_share_token").execute()
        share_token = token_result.data

        # Update conversation
        update_data = {
            "is_shared": True,
            "share_token": share_token,
            "shared_at": datetime.now(timezone.utc).isoformat(),
            "share_permissions": permission,
            "share_billing": billing,
            "share_max_participants": max_participants,
            "participant_access_duration": participant_access_duration
        }

        if expires_at:
            update_data["share_expires_at"] = expires_at.isoformat()

        if participant_access_duration == "custom" and participant_access_custom_hours:
            update_data["participant_access_hours"] = participant_access_custom_hours

        result = supabase.table("conversations").update(update_data).eq(
            "id", conversation_id
        ).execute()

        return result.data[0]

    result = await asyncio.to_thread(_verify_and_share)

    return {
        "conversation_id": conversation_id,
        "share_token": result["share_token"],
        "permission": result["share_permissions"],
        "billing": result["share_billing"],
        "shared_at": result["shared_at"],
        "expires_at": result.get("share_expires_at"),
        "max_participants": result.get("share_max_participants", 10),
        "participant_access_duration": result.get("participant_access_duration", "forever"),
        "participant_access_hours": result.get("participant_access_hours")
    }


async def unshare_conversation(
    supabase,
    user_id: str,
    conversation_id: str
) -> bool:
    """
    Disable sharing for a conversation.

    Returns:
        True if successful
    """

    def _unshare():
        # Verify ownership and unshare
        result = supabase.table("conversations").update({
            "is_shared": False,
            "share_token": None,
            "shared_at": None
        }).eq("id", conversation_id).eq("user_id", user_id).execute()

        # Remove all participants
        supabase.table("conversation_participants").delete().eq(
            "conversation_id", conversation_id
        ).execute()

        return len(result.data) > 0

    return await asyncio.to_thread(_unshare)


async def join_shared_conversation(
    supabase,
    user_id: str,
    share_token: str,
    join_ip: Optional[str] = None,
    join_user_agent: Optional[str] = None
) -> Dict[str, Any]:
    """
    Join a shared conversation using share token with enhanced security checks.

    Returns:
        Conversation details
    """

    def _join():
        # Find conversation by share token
        conv = supabase.table("conversations").select("*").eq(
            "share_token", share_token
        ).eq("is_shared", True).execute()

        if not conv.data:
            raise Exception("Invalid or expired share link")

        conversation = conv.data[0]

        # Check expiration
        if conversation.get("share_expires_at"):
            expires_at = datetime.fromisoformat(conversation["share_expires_at"].replace('Z', '+00:00'))
            if datetime.now(timezone.utc) > expires_at:
                raise Exception("Share link has expired")

        # Check participant limit
        if conversation.get("share_max_participants"):
            participant_count = supabase.table("conversation_participants").select(
                "id", count="exact"
            ).eq("conversation_id", conversation["id"]).eq("is_active", True).execute()

            if participant_count.count >= conversation["share_max_participants"]:
                raise Exception(f"Maximum participants ({conversation['share_max_participants']}) reached")

        # Don't add owner as participant
        if conversation["user_id"] == user_id:
            return conversation

        # Log join event
        supabase.table("share_token_usage").insert({
            "conversation_id": conversation["id"],
            "share_token": share_token,
            "joined_user_id": user_id,
            "join_ip": join_ip,
            "join_user_agent": join_user_agent
        }).execute()

        # Increment join count
        current_join_count = conversation.get("share_join_count", 0)
        supabase.table("conversations").update({
            "share_join_count": current_join_count + 1
        }).eq("id", conversation["id"]).execute()

        # Check if user already participant (rejoin case)
        existing = supabase.table("conversation_participants").select("*").eq(
            "conversation_id", conversation["id"]
        ).eq("user_id", user_id).execute()

        if existing.data:
            # Reactivate if inactive
            supabase.table("conversation_participants").update({
                "is_active": True,
                "last_seen_at": datetime.now(timezone.utc).isoformat()
            }).eq("conversation_id", conversation["id"]).eq("user_id", user_id).execute()
        else:
            # Add user as participant
            supabase.table("conversation_participants").insert({
                "conversation_id": conversation["id"],
                "user_id": user_id,
                "permission": conversation["share_permissions"],
                "joined_at": datetime.now(timezone.utc).isoformat()
            }).execute()

        return conversation

    return await asyncio.to_thread(_join)


async def leave_shared_conversation(
    supabase,
    user_id: str,
    conversation_id: str
) -> bool:
    """
    Leave a shared conversation.

    Returns:
        True if successful
    """

    def _leave():
        result = supabase.table("conversation_participants").delete().eq(
            "conversation_id", conversation_id
        ).eq("user_id", user_id).execute()

        return len(result.data) > 0

    return await asyncio.to_thread(_leave)


async def get_conversation_participants(
    supabase,
    conversation_id: str,
    user_id: str
) -> List[Dict[str, Any]]:
    """
    Get list of participants in a conversation.

    Returns:
        List of participants with user info
    """

    def _get_participants():
        # Verify user has access
        has_access = supabase.table("conversations").select("id").eq(
            "id", conversation_id
        ).or_(f"user_id.eq.{user_id}").execute()

        if not has_access.data:
            participant = supabase.table("conversation_participants").select("conversation_id").eq(
                "conversation_id", conversation_id
            ).eq("user_id", user_id).execute()

            if not participant.data:
                raise Exception("Access denied")

        # Get participants
        participants = supabase.table("conversation_participants").select(
            "user_id, permission, joined_at, last_seen_at, is_active"
        ).eq("conversation_id", conversation_id).eq("is_active", True).execute()

        return participants.data or []

    return await asyncio.to_thread(_get_participants)


async def update_participant_permission(
    supabase,
    conversation_id: str,
    owner_id: str,
    participant_user_id: str,
    permission: str
) -> bool:
    """
    Update permission level for a participant (owner only).

    Args:
        permission: view or chat

    Returns:
        True if successful
    """

    def _update():
        # Verify ownership
        conv = supabase.table("conversations").select("id").eq(
            "id", conversation_id
        ).eq("user_id", owner_id).execute()

        if not conv.data:
            raise Exception("Only conversation owner can update permissions")

        # Update participant
        result = supabase.table("conversation_participants").update({
            "permission": permission
        }).eq("conversation_id", conversation_id).eq(
            "user_id", participant_user_id
        ).execute()

        return len(result.data) > 0

    return await asyncio.to_thread(_update)


async def remove_participant(
    supabase,
    conversation_id: str,
    owner_id: str,
    participant_user_id: str
) -> bool:
    """
    Remove a participant from conversation (owner only).

    Returns:
        True if successful
    """

    def _remove():
        # Verify ownership
        conv = supabase.table("conversations").select("id").eq(
            "id", conversation_id
        ).eq("user_id", owner_id).execute()

        if not conv.data:
            raise Exception("Only conversation owner can remove participants")

        # Remove participant
        result = supabase.table("conversation_participants").delete().eq(
            "conversation_id", conversation_id
        ).eq("user_id", participant_user_id).execute()

        return len(result.data) > 0

    return await asyncio.to_thread(_remove)


async def update_presence(
    supabase,
    conversation_id: str,
    user_id: str,
    is_typing: bool = False
) -> bool:
    """
    Update user presence in a conversation.

    Returns:
        True if successful
    """

    def _update():
        result = supabase.rpc("update_presence_heartbeat", {
            "p_conversation_id": conversation_id,
            "p_user_id": user_id,
            "p_is_typing": is_typing
        }).execute()
        return True

    try:
        return await asyncio.to_thread(_update)
    except:
        return False


async def get_active_presence(
    supabase,
    conversation_id: str
) -> List[Dict[str, Any]]:
    """
    Get list of users currently active in conversation.
    Active = heartbeat within last 30 seconds.

    Returns:
        List of active users with typing status
    """

    def _get_presence():
        cutoff = datetime.now(timezone.utc)
        cutoff = cutoff.replace(second=cutoff.second - 30)

        result = supabase.table("conversation_presence").select(
            "user_id, is_typing, last_heartbeat"
        ).eq("conversation_id", conversation_id).gte(
            "last_heartbeat", cutoff.isoformat()
        ).execute()

        return result.data or []

    return await asyncio.to_thread(_get_presence)
