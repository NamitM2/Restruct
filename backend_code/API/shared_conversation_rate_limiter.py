"""
Rate limiting for shared conversation participants.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple


async def check_participant_rate_limit(
    supabase,
    conversation_id: str,
    user_id: str,
    is_owner: bool
) -> Tuple[bool, Optional[str]]:
    """
    Check if participant is within rate limits for this conversation.

    Rate limits:
    - Owners: No limits (they own the conversation)
    - Chat participants: 10 RPM, 100 RPH, 500 RPD
    - View participants: Should never reach this (frontend blocks)

    Args:
        supabase: Supabase client
        conversation_id: Conversation ID
        user_id: User ID
        is_owner: Whether user is the conversation owner

    Returns:
        Tuple of (is_allowed, error_message)
    """

    def _check():
        # Owners have no rate limits
        if is_owner:
            return True, None

        # Participant rate limits
        RATE_LIMIT_RPM = 10
        RATE_LIMIT_RPH = 100
        RATE_LIMIT_RPD = 500

        now = datetime.now(timezone.utc)

        # Get or create rate limit tracking record
        result = supabase.table("participant_rate_limits").select("*").eq(
            "conversation_id", conversation_id
        ).eq("user_id", user_id).execute()

        if not result.data:
            # Create new tracking record
            supabase.table("participant_rate_limits").insert({
                "conversation_id": conversation_id,
                "user_id": user_id,
                "minute_window": now.isoformat(),
                "hour_window": now.isoformat(),
                "day_window": now.isoformat(),
                "requests_this_minute": 1,
                "requests_this_hour": 1,
                "requests_this_day": 1
            }).execute()
            return True, None

        record = result.data[0]

        # Parse timestamps
        minute_window = datetime.fromisoformat(record["minute_window"].replace('Z', '+00:00'))
        hour_window = datetime.fromisoformat(record["hour_window"].replace('Z', '+00:00'))
        day_window = datetime.fromisoformat(record["day_window"].replace('Z', '+00:00'))

        # Reset counters if windows have passed
        requests_this_minute = record["requests_this_minute"]
        requests_this_hour = record["requests_this_hour"]
        requests_this_day = record["requests_this_day"]

        if now - minute_window >= timedelta(minutes=1):
            requests_this_minute = 0
            minute_window = now

        if now - hour_window >= timedelta(hours=1):
            requests_this_hour = 0
            hour_window = now

        if now - day_window >= timedelta(days=1):
            requests_this_day = 0
            day_window = now

        # Check limits
        if requests_this_minute >= RATE_LIMIT_RPM:
            return False, f"Participant rate limit exceeded: {RATE_LIMIT_RPM} requests per minute. Please slow down."

        if requests_this_hour >= RATE_LIMIT_RPH:
            return False, f"Participant rate limit exceeded: {RATE_LIMIT_RPH} requests per hour. Please wait before sending more messages."

        if requests_this_day >= RATE_LIMIT_RPD:
            return False, f"Participant rate limit exceeded: {RATE_LIMIT_RPD} requests per day. Daily limit reached."

        # Increment counters
        requests_this_minute += 1
        requests_this_hour += 1
        requests_this_day += 1

        # Update tracking record
        supabase.table("participant_rate_limits").update({
            "minute_window": minute_window.isoformat(),
            "hour_window": hour_window.isoformat(),
            "day_window": day_window.isoformat(),
            "requests_this_minute": requests_this_minute,
            "requests_this_hour": requests_this_hour,
            "requests_this_day": requests_this_day,
            "updated_at": now.isoformat()
        }).eq("conversation_id", conversation_id).eq("user_id", user_id).execute()

        return True, None

    return await asyncio.to_thread(_check)


async def check_conversation_rate_limit(
    supabase,
    conversation_id: str
) -> Tuple[bool, Optional[str]]:
    """
    Check conversation-wide rate limits (all participants combined).

    Prevents coordinated abuse from multiple accounts.

    Limits:
    - 100 messages per minute total
    - 1000 messages per hour total

    Args:
        supabase: Supabase client
        conversation_id: Conversation ID

    Returns:
        Tuple of (is_allowed, error_message)
    """

    def _check():
        RATE_LIMIT_RPM = 100
        RATE_LIMIT_RPH = 1000

        now = datetime.now(timezone.utc)

        # Get or create rate limit tracking record
        result = supabase.table("conversation_rate_limits").select("*").eq(
            "conversation_id", conversation_id
        ).execute()

        if not result.data:
            # Create new tracking record
            supabase.table("conversation_rate_limits").insert({
                "conversation_id": conversation_id,
                "minute_window": now.isoformat(),
                "hour_window": now.isoformat(),
                "requests_this_minute": 1,
                "requests_this_hour": 1
            }).execute()
            return True, None

        record = result.data[0]

        # Parse timestamps
        minute_window = datetime.fromisoformat(record["minute_window"].replace('Z', '+00:00'))
        hour_window = datetime.fromisoformat(record["hour_window"].replace('Z', '+00:00'))

        # Reset counters if windows have passed
        requests_this_minute = record["requests_this_minute"]
        requests_this_hour = record["requests_this_hour"]

        if now - minute_window >= timedelta(minutes=1):
            requests_this_minute = 0
            minute_window = now

        if now - hour_window >= timedelta(hours=1):
            requests_this_hour = 0
            hour_window = now

        # Check limits
        if requests_this_minute >= RATE_LIMIT_RPM:
            return False, f"Conversation rate limit exceeded: {RATE_LIMIT_RPM} total messages per minute. This conversation is experiencing high traffic."

        if requests_this_hour >= RATE_LIMIT_RPH:
            return False, f"Conversation rate limit exceeded: {RATE_LIMIT_RPH} total messages per hour. This conversation has reached its hourly limit."

        # Increment counters
        requests_this_minute += 1
        requests_this_hour += 1

        # Update tracking record
        supabase.table("conversation_rate_limits").update({
            "minute_window": minute_window.isoformat(),
            "hour_window": hour_window.isoformat(),
            "requests_this_minute": requests_this_minute,
            "requests_this_hour": requests_this_hour,
            "updated_at": now.isoformat()
        }).eq("conversation_id", conversation_id).execute()

        return True, None

    return await asyncio.to_thread(_check)


async def get_participant_info(
    supabase,
    conversation_id: str,
    user_id: str
) -> Optional[dict]:
    """
    Get participant information for a user in a conversation.

    Returns:
        {
            "is_owner": bool,
            "permission": "view" | "chat",
            "is_active": bool,
            "is_participant": bool,
            "access_expired": bool,
            "access_expires_at": str | None
        }
        or None if no access
    """

    def _get():
        # Check if owner
        conv = supabase.table("conversations").select("user_id").eq(
            "id", conversation_id
        ).execute()

        if conv.data and conv.data[0]["user_id"] == user_id:
            return {
                "is_owner": True,
                "permission": "chat",
                "is_active": True,
                "is_participant": False,
                "access_expired": False,
                "access_expires_at": None
            }

        # Check if participant
        participant = supabase.table("conversation_participants").select("*").eq(
            "conversation_id", conversation_id
        ).eq("user_id", user_id).execute()

        if not participant.data:
            return None

        p = participant.data[0]

        # Check if access has expired
        access_expired = False
        access_expires_at = p.get("access_expires_at")

        if access_expires_at:
            from datetime import datetime, timezone
            expires_dt = datetime.fromisoformat(access_expires_at.replace('Z', '+00:00'))
            access_expired = datetime.now(timezone.utc) > expires_dt

        return {
            "is_owner": False,
            "permission": p.get("permission", "view"),
            "is_active": p.get("is_active", True),
            "is_participant": True,
            "blocked_for_abuse": p.get("blocked_for_abuse", False),
            "access_expired": access_expired,
            "access_expires_at": access_expires_at
        }

    return await asyncio.to_thread(_get)
