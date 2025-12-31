"""
Per-API-key rate limiting.

Enforces rate limits at the individual key level, independent of profiles.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple


async def check_key_rate_limit(
    supabase,
    api_key_id: str,
    rpm_limit: Optional[int],
    rph_limit: Optional[int],
    rpd_limit: Optional[int]
) -> Tuple[bool, Optional[str]]:
    """
    Check if an API key is within its rate limits.

    Args:
        supabase: Supabase client
        api_key_id: API key ID
        rpm_limit: Requests per minute limit (None = no limit)
        rph_limit: Requests per hour limit (None = no limit)
        rpd_limit: Requests per day limit (None = no limit)

    Returns:
        (allowed: bool, error_message: Optional[str])
    """

    # If no limits configured, allow
    if not any([rpm_limit, rph_limit, rpd_limit]):
        return True, None

    now = datetime.now(timezone.utc)

    # Check each time window
    limits_to_check = []
    if rpm_limit:
        limits_to_check.append(("minute", rpm_limit, now.replace(second=0, microsecond=0)))
    if rph_limit:
        limits_to_check.append(("hour", rph_limit, now.replace(minute=0, second=0, microsecond=0)))
    if rpd_limit:
        limits_to_check.append(("day", rpd_limit, now.replace(hour=0, minute=0, second=0, microsecond=0)))

    for window_type, limit, window_start in limits_to_check:
        # Get current count for this window
        def _query():
            return supabase.table("api_key_rate_limits").select("request_count").eq(
                "api_key_id", api_key_id
            ).eq("window_type", window_type).eq("window_start", window_start.isoformat()).execute()

        result = await asyncio.to_thread(_query)

        current_count = result.data[0]["request_count"] if result.data else 0

        # Check if limit exceeded
        if current_count >= limit:
            time_unit = {"minute": "minute", "hour": "hour", "day": "day"}[window_type]
            return False, f"Rate limit exceeded: {limit} requests per {time_unit}. Please retry later."

    return True, None


async def increment_key_rate_limit(
    supabase,
    api_key_id: str
):
    """
    Increment request count for all active rate limit windows.

    This should be called AFTER a successful request.
    """
    now = datetime.now(timezone.utc)

    # Define all possible windows
    windows = [
        ("minute", now.replace(second=0, microsecond=0)),
        ("hour", now.replace(minute=0, second=0, microsecond=0)),
        ("day", now.replace(hour=0, minute=0, second=0, microsecond=0))
    ]

    for window_type, window_start in windows:
        # Upsert (insert or increment)
        def _upsert():
            # Try to get existing record
            existing = supabase.table("api_key_rate_limits").select("id, request_count").eq(
                "api_key_id", api_key_id
            ).eq("window_type", window_type).eq("window_start", window_start.isoformat()).execute()

            if existing.data:
                # Increment existing
                return supabase.table("api_key_rate_limits").update({
                    "request_count": existing.data[0]["request_count"] + 1,
                    "updated_at": now.isoformat()
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                # Insert new
                return supabase.table("api_key_rate_limits").insert({
                    "api_key_id": api_key_id,
                    "window_type": window_type,
                    "window_start": window_start.isoformat(),
                    "request_count": 1
                }).execute()

        try:
            await asyncio.to_thread(_upsert)
        except Exception as e:
            # Don't fail the request if rate limit tracking fails
            print(f"Warning: Failed to increment rate limit counter: {e}")
            pass


async def get_key_rate_limit_status(
    supabase,
    api_key_id: str,
    rpm_limit: Optional[int],
    rph_limit: Optional[int],
    rpd_limit: Optional[int]
) -> dict:
    """
    Get current rate limit status for an API key.

    Returns:
        {
            "minute": {"current": 45, "limit": 60, "remaining": 15},
            "hour": {"current": 230, "limit": 1000, "remaining": 770},
            "day": {"current": 1250, "limit": 10000, "remaining": 8750}
        }
    """
    now = datetime.now(timezone.utc)
    status = {}

    limits_config = {
        "minute": (rpm_limit, now.replace(second=0, microsecond=0)),
        "hour": (rph_limit, now.replace(minute=0, second=0, microsecond=0)),
        "day": (rpd_limit, now.replace(hour=0, minute=0, second=0, microsecond=0))
    }

    for window_type, (limit, window_start) in limits_config.items():
        if limit is None:
            continue

        # Get current count
        def _query():
            return supabase.table("api_key_rate_limits").select("request_count").eq(
                "api_key_id", api_key_id
            ).eq("window_type", window_type).eq("window_start", window_start.isoformat()).execute()

        result = await asyncio.to_thread(_query)
        current = result.data[0]["request_count"] if result.data else 0

        status[window_type] = {
            "current": current,
            "limit": limit,
            "remaining": max(0, limit - current),
            "reset_at": (window_start + timedelta(**{f"{window_type}s": 1})).isoformat()
        }

    return status
