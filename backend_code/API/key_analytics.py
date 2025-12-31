"""
Per-API-key usage analytics.

Provides detailed usage statistics for individual API keys.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional


async def get_key_usage_stats(
    supabase,
    user_id: str,
    api_key_id: str,
    time_range: str = "7d"
) -> Dict[str, Any]:
    """
    Get usage statistics for a specific API key.

    Args:
        supabase: Supabase client
        user_id: User ID (for authorization)
        api_key_id: API key ID
        time_range: 24h, 7d, 30d, all

    Returns:
        Dictionary with comprehensive usage stats
    """

    # Verify key belongs to user
    def _verify():
        return supabase.table("api_keys").select("id, name, key_prefix").eq(
            "id", api_key_id
        ).eq("user_id", user_id).execute()

    key_result = await asyncio.to_thread(_verify)
    if not key_result.data:
        return None

    key_info = key_result.data[0]

    # Calculate time window
    now = datetime.now(timezone.utc)
    time_filters = {
        "24h": now - timedelta(hours=24),
        "7d": now - timedelta(days=7),
        "30d": now - timedelta(days=30),
        "all": None
    }
    start_time = time_filters.get(time_range)

    # Query usage data
    def _query():
        query = supabase.table("api_usage").select("*").eq("api_key_id", api_key_id)
        if start_time:
            query = query.gte("created_at", start_time.isoformat())
        return query.order("created_at", desc=True).execute()

    result = await asyncio.to_thread(_query)
    usage_data = result.data or []

    # Calculate aggregates
    total_cost = sum(float(item.get("estimated_cost", 0)) for item in usage_data)
    total_input_tokens = sum(int(item.get("input_tokens", 0)) for item in usage_data)
    total_output_tokens = sum(int(item.get("output_tokens", 0)) for item in usage_data)
    total_tokens = total_input_tokens + total_output_tokens
    request_count = len(usage_data)

    # Success rate
    success_count = sum(1 for item in usage_data if item.get("status_code") == 200)
    success_rate = (success_count / request_count * 100) if request_count > 0 else 0

    # Average latency
    latencies = [item.get("request_duration_ms", 0) for item in usage_data if item.get("request_duration_ms")]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0

    # Model breakdown
    model_usage = {}
    for item in usage_data:
        provider = item.get("provider", "unknown")
        model = item.get("model", "unknown")
        key = f"{provider}:{model}"

        if key not in model_usage:
            model_usage[key] = {
                "provider": provider,
                "model": model,
                "requests": 0,
                "cost": 0,
                "tokens": 0
            }

        model_usage[key]["requests"] += 1
        model_usage[key]["cost"] += float(item.get("estimated_cost", 0))
        model_usage[key]["tokens"] += int(item.get("input_tokens", 0)) + int(item.get("output_tokens", 0))

    # Sort by cost
    top_models = sorted(model_usage.values(), key=lambda x: x["cost"], reverse=True)[:5]

    # Profile breakdown
    profile_usage = {}
    for item in usage_data:
        profile = item.get("profile_name") or "default"
        if profile not in profile_usage:
            profile_usage[profile] = {"requests": 0, "cost": 0}
        profile_usage[profile]["requests"] += 1
        profile_usage[profile]["cost"] += float(item.get("estimated_cost", 0))

    top_profiles = sorted(profile_usage.items(), key=lambda x: x[1]["cost"], reverse=True)[:5]

    return {
        "key_info": {
            "id": key_info["id"],
            "name": key_info["name"],
            "key_prefix": key_info["key_prefix"]
        },
        "time_range": time_range,
        "summary": {
            "total_requests": request_count,
            "total_cost": round(total_cost, 4),
            "total_tokens": total_tokens,
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "success_rate": round(success_rate, 2),
            "avg_latency_ms": round(avg_latency, 2)
        },
        "top_models": top_models,
        "top_profiles": [{"profile": p, **stats} for p, stats in top_profiles],
        "recent_requests": [
            {
                "timestamp": item["created_at"],
                "provider": item.get("provider"),
                "model": item.get("model"),
                "profile": item.get("profile_name"),
                "tokens": int(item.get("input_tokens", 0)) + int(item.get("output_tokens", 0)),
                "cost": float(item.get("estimated_cost", 0)),
                "status": item.get("status_code"),
                "latency_ms": item.get("request_duration_ms")
            }
            for item in usage_data[:20]  # Last 20 requests
        ]
    }


async def get_key_usage_timeline(
    supabase,
    user_id: str,
    api_key_id: str,
    days: int = 30
) -> List[Dict[str, Any]]:
    """
    Get daily usage timeline for a specific API key.

    Returns:
        List of daily aggregates
    """

    # Verify key belongs to user
    def _verify():
        return supabase.table("api_keys").select("id").eq(
            "id", api_key_id
        ).eq("user_id", user_id).execute()

    key_result = await asyncio.to_thread(_verify)
    if not key_result.data:
        return None

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=days)

    # Query usage data
    def _query():
        return supabase.table("api_usage").select("*").eq(
            "api_key_id", api_key_id
        ).gte("created_at", start_date.isoformat()).execute()

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
                "requests": 0,
                "cost": 0,
                "tokens": 0,
                "errors": 0
            }

        daily_stats[date_key]["requests"] += 1
        daily_stats[date_key]["cost"] += float(item.get("estimated_cost", 0))
        daily_stats[date_key]["tokens"] += int(item.get("input_tokens", 0)) + int(item.get("output_tokens", 0))
        if item.get("status_code") != 200:
            daily_stats[date_key]["errors"] += 1

    # Convert to list and sort by date
    timeline = list(daily_stats.values())
    timeline.sort(key=lambda x: x["date"])

    return timeline


async def compare_keys_usage(
    supabase,
    user_id: str,
    time_range: str = "7d"
) -> List[Dict[str, Any]]:
    """
    Compare usage across all API keys for a user.

    Returns:
        List of key statistics sorted by cost
    """

    # Get all user's keys
    def _get_keys():
        return supabase.table("api_keys").select("id, name, key_prefix, is_active").eq(
            "user_id", user_id
        ).execute()

    keys_result = await asyncio.to_thread(_get_keys)
    keys = keys_result.data or []

    # Calculate time window
    now = datetime.now(timezone.utc)
    time_filters = {
        "24h": now - timedelta(hours=24),
        "7d": now - timedelta(days=7),
        "30d": now - timedelta(days=30),
        "all": None
    }
    start_time = time_filters.get(time_range)

    comparison = []

    for key in keys:
        # Query usage for this key
        def _query():
            query = supabase.table("api_usage").select("*").eq("api_key_id", key["id"])
            if start_time:
                query = query.gte("created_at", start_time.isoformat())
            return query.execute()

        result = await asyncio.to_thread(_query)
        usage_data = result.data or []

        total_cost = sum(float(item.get("estimated_cost", 0)) for item in usage_data)
        total_tokens = sum(
            int(item.get("input_tokens", 0)) + int(item.get("output_tokens", 0))
            for item in usage_data
        )
        request_count = len(usage_data)
        success_count = sum(1 for item in usage_data if item.get("status_code") == 200)
        success_rate = (success_count / request_count * 100) if request_count > 0 else 0

        comparison.append({
            "key_id": key["id"],
            "name": key["name"],
            "key_prefix": key["key_prefix"],
            "is_active": key["is_active"],
            "requests": request_count,
            "cost": round(total_cost, 4),
            "tokens": total_tokens,
            "success_rate": round(success_rate, 2)
        })

    # Sort by cost descending
    comparison.sort(key=lambda x: x["cost"], reverse=True)

    return comparison
