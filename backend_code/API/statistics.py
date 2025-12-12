"""
Statistics and Analytics API Functions.

Provides real-time statistics from api_usage table.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta, timezone
import asyncio


async def get_user_statistics(supabase, user_id: str, time_range: str = "all") -> Dict[str, Any]:
    """
    Get comprehensive statistics for a user.

    Args:
        supabase: Supabase client
        user_id: User ID
        time_range: all, 24h, 7d, 30d, 1y

    Returns:
        Dictionary with spending and token statistics
    """
    # Calculate time window
    now = datetime.now(timezone.utc)
    time_filters = {
        "24h": now - timedelta(hours=24),
        "7d": now - timedelta(days=7),
        "30d": now - timedelta(days=30),
        "1y": now - timedelta(days=365),
        "all": None
    }

    start_time = time_filters.get(time_range)

    def _query():
        query = supabase.table("api_usage").select("*").eq("user_id", user_id)
        if start_time:
            query = query.gte("created_at", start_time.isoformat())
        return query.execute()

    result = await asyncio.to_thread(_query)
    usage_data = result.data or []

    # Calculate aggregates
    total_cost = sum(float(item.get("estimated_cost", 0)) for item in usage_data)
    total_input_tokens = sum(int(item.get("input_tokens", 0)) for item in usage_data)
    total_output_tokens = sum(int(item.get("output_tokens", 0)) for item in usage_data)
    total_tokens = total_input_tokens + total_output_tokens
    request_count = len(usage_data)

    return {
        "total_cost": total_cost,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "total_tokens": total_tokens,
        "request_count": request_count,
        "time_range": time_range
    }


async def get_dashboard_metrics(supabase, user_id: str) -> Dict[str, Any]:
    """
    Get dashboard metrics with daily, weekly, monthly, yearly breakdowns.
    """
    now = datetime.now(timezone.utc)

    # Define time windows
    windows = {
        "daily": now - timedelta(days=1),
        "weekly": now - timedelta(days=7),
        "monthly": now - timedelta(days=30),
        "yearly": now - timedelta(days=365)
    }

    def _query():
        return supabase.table("api_usage").select("*").eq("user_id", user_id).execute()

    result = await asyncio.to_thread(_query)
    all_usage = result.data or []

    # Calculate metrics for each window
    metrics = {
        "spending": {},
        "tokens": {}
    }

    for period, start_time in windows.items():
        filtered = [item for item in all_usage if datetime.fromisoformat(item["created_at"].replace('Z', '+00:00')) >= start_time]

        total_cost = sum(float(item.get("estimated_cost", 0)) for item in filtered)
        total_input = sum(int(item.get("input_tokens", 0)) for item in filtered)
        total_output = sum(int(item.get("output_tokens", 0)) for item in filtered)

        metrics["spending"][period] = total_cost
        metrics["tokens"][period] = total_input + total_output

    # Add last 24h specifically
    last_24h = [item for item in all_usage if datetime.fromisoformat(item["created_at"].replace('Z', '+00:00')) >= windows["daily"]]
    metrics["spending"]["last24"] = sum(float(item.get("estimated_cost", 0)) for item in last_24h)

    return metrics


async def get_model_breakdown(supabase, user_id: str, profile_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get usage breakdown by model.

    Args:
        supabase: Supabase client
        user_id: User ID
        profile_name: Optional profile filter (None = all profiles)

    Returns:
        List of model usage statistics
    """
    def _query():
        query = supabase.table("api_usage").select("*").eq("user_id", user_id)
        if profile_name and profile_name != "all":
            query = query.eq("profile_name", profile_name)
        return query.execute()

    result = await asyncio.to_thread(_query)
    usage_data = result.data or []

    # Group by provider:model
    model_stats = {}

    for item in usage_data:
        provider = item.get("provider", "unknown")
        model = item.get("model", "unknown")
        key = f"{provider}:{model}"

        if key not in model_stats:
            model_stats[key] = {
                "provider": provider,
                "model": model,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_cost": 0,
                "request_count": 0
            }

        model_stats[key]["input_tokens"] += int(item.get("input_tokens", 0))
        model_stats[key]["output_tokens"] += int(item.get("output_tokens", 0))
        model_stats[key]["total_cost"] += float(item.get("estimated_cost", 0))
        model_stats[key]["request_count"] += 1

    # Convert to list and sort by cost descending
    breakdown = list(model_stats.values())
    breakdown.sort(key=lambda x: x["total_cost"], reverse=True)

    return breakdown


async def get_profile_breakdown(supabase, user_id: str) -> List[Dict[str, Any]]:
    """
    Get usage breakdown by profile.
    """
    def _query():
        return supabase.table("api_usage").select("*").eq("user_id", user_id).execute()

    result = await asyncio.to_thread(_query)
    usage_data = result.data or []

    # Group by profile_name
    profile_stats = {}

    for item in usage_data:
        profile = item.get("profile_name") or "default"

        if profile not in profile_stats:
            profile_stats[profile] = {
                "profile_name": profile,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_cost": 0,
                "request_count": 0
            }

        profile_stats[profile]["input_tokens"] += int(item.get("input_tokens", 0))
        profile_stats[profile]["output_tokens"] += int(item.get("output_tokens", 0))
        profile_stats[profile]["total_cost"] += float(item.get("estimated_cost", 0))
        profile_stats[profile]["request_count"] += 1

    # Convert to list and sort by cost descending
    breakdown = list(profile_stats.values())
    breakdown.sort(key=lambda x: x["total_cost"], reverse=True)

    return breakdown


async def get_usage_timeline(supabase, user_id: str, days: int = 30) -> List[Dict[str, Any]]:
    """
    Get daily usage timeline for charting.

    Args:
        supabase: Supabase client
        user_id: User ID
        days: Number of days to include

    Returns:
        List of daily aggregates [{"date": "2025-01-15", "cost": 12.34, "tokens": 50000, "requests": 23}, ...]
    """
    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    def _query():
        return supabase.table("api_usage").select("*").eq("user_id", user_id).gte("created_at", start_date.isoformat()).execute()

    result = await asyncio.to_thread(_query)
    usage_data = result.data or []

    # Group by date
    daily_stats = {}

    for item in usage_data:
        created_at = datetime.fromisoformat(item["created_at"].replace('Z', '+00:00'))
        date_key = created_at.strftime("%Y-%m-%d")

        if date_key not in daily_stats:
            daily_stats[date_key] = {
                "date": date_key,
                "cost": 0,
                "tokens": 0,
                "requests": 0
            }

        daily_stats[date_key]["cost"] += float(item.get("estimated_cost", 0))
        daily_stats[date_key]["tokens"] += int(item.get("input_tokens", 0)) + int(item.get("output_tokens", 0))
        daily_stats[date_key]["requests"] += 1

    # Convert to list and sort by date
    timeline = list(daily_stats.values())
    timeline.sort(key=lambda x: x["date"])

    return timeline
