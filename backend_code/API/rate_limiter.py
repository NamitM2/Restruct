"""
Per-profile rate limiting functionality.
"""

from datetime import datetime, timedelta
from typing import Optional, Tuple


async def check_rate_limit(
    supabase,
    user_id: str,
    profile_slug: str,
    rate_limit_rpm: Optional[int],
    rate_limit_rph: Optional[int],
    rate_limit_rpd: Optional[int]
) -> Tuple[bool, Optional[str]]:
    """
    Check if request is within rate limits for this profile.

    Args:
        supabase: Supabase client
        user_id: User ID
        profile_slug: Profile slug
        rate_limit_rpm: Max requests per minute (None = no limit)
        rate_limit_rph: Max requests per hour (None = no limit)
        rate_limit_rpd: Max requests per day (None = no limit)

    Returns:
        Tuple of (is_allowed, error_message)
    """
    # If no rate limits set, allow request
    if not rate_limit_rpm and not rate_limit_rph and not rate_limit_rpd:
        return True, None

    now = datetime.utcnow()

    # Get or create rate limit tracking record
    result = supabase.table("profile_rate_limits").select("*").eq(
        "user_id", user_id
    ).eq("profile_slug", profile_slug).execute()

    if not result.data:
        # Create new tracking record
        supabase.table("profile_rate_limits").insert({
            "user_id": user_id,
            "profile_slug": profile_slug,
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
    if rate_limit_rpm and requests_this_minute >= rate_limit_rpm:
        return False, f"Rate limit exceeded: {rate_limit_rpm} requests per minute"

    if rate_limit_rph and requests_this_hour >= rate_limit_rph:
        return False, f"Rate limit exceeded: {rate_limit_rph} requests per hour"

    if rate_limit_rpd and requests_this_day >= rate_limit_rpd:
        return False, f"Rate limit exceeded: {rate_limit_rpd} requests per day"

    # Increment counters
    requests_this_minute += 1
    requests_this_hour += 1
    requests_this_day += 1

    # Update tracking record
    supabase.table("profile_rate_limits").update({
        "minute_window": minute_window.isoformat(),
        "hour_window": hour_window.isoformat(),
        "day_window": day_window.isoformat(),
        "requests_this_minute": requests_this_minute,
        "requests_this_hour": requests_this_hour,
        "requests_this_day": requests_this_day,
        "updated_at": now.isoformat()
    }).eq("user_id", user_id).eq("profile_slug", profile_slug).execute()

    return True, None
