"""
Profiles module: creation, retrieval, and routing helpers for routing_profiles.

All functions accept an explicit Supabase client to avoid circular imports.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4
import json
import os
import re as _re

import backend_code.models_config as models_config
import backend_code.inference as inference
from backend_code import router as base_router

MODELS = models_config.MODELS

# Minimal provider preset list to ensure new profiles have working defaults.
DEFAULT_PROVIDERS = [
    {"id": "openai", "label": "OpenAI", "enabled": True},
    {"id": "anthropic", "label": "Anthropic", "enabled": True},
    {"id": "google", "label": "Google", "enabled": True},
]


def slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-") or "profile"
    suffix = uuid4().hex[:6]
    return f"{base}-{suffix}"


def default_graph_state() -> Dict[str, Any]:
    return {
        "weights": [
            {"id": "quality", "label": "Quality", "weight": 0.45},
            {"id": "cost", "label": "Cost", "weight": 0.35},
            {"id": "latency", "label": "Latency", "weight": 0.20},
        ],
        "hardLimits": {
            "maxCostPerCall": None,
            "maxOutputTokens": None,
            "dailySpendLimit": None,
            "dailyOutputTokens": None,
        },
        "providers": DEFAULT_PROVIDERS,
        "rules": [],
    }


def normalize_graph_state(graph_state: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(graph_state, dict):
        return default_graph_state()

    normalized = default_graph_state()

    if isinstance(graph_state.get("weights"), list):
        normalized["weights"] = graph_state["weights"]

    if isinstance(graph_state.get("hardLimits") or graph_state.get("hard_limits"), dict):
        limits = graph_state.get("hardLimits") or graph_state.get("hard_limits")
        normalized["hardLimits"].update(limits)

    if isinstance(graph_state.get("providers"), list) and graph_state["providers"]:
        normalized["providers"] = graph_state["providers"]

    if isinstance(graph_state.get("rules"), list):
        normalized["rules"] = graph_state["rules"]

    return normalized


def create_profile(
    supabase,
    *,
    user_id: str,
    name: str,
    description: Optional[str],
    graph_state: Optional[Dict[str, Any]],
    icon: Optional[str] = None,
) -> Dict[str, Any]:
    payload = {
        "user_id": user_id,
        "name": name,
        "description": description,
        "graph_state": normalize_graph_state(graph_state),
        "slug": slugify(name),
        "icon": icon or "zap",
    }
    result = supabase.table("routing_profiles").insert(payload).execute()
    return result.data[0]


def update_profile(
    supabase,
    *,
    user_id: str,
    slug: str,
    updates: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    allowed = {}
    if "name" in updates:
        allowed["name"] = updates["name"]
    if "description" in updates:
        allowed["description"] = updates["description"]
    if "graph_state" in updates:
        allowed["graph_state"] = normalize_graph_state(updates["graph_state"])
    if "published" in updates:
        allowed["published"] = updates["published"]
    if "icon" in updates:
        allowed["icon"] = updates["icon"]

    if not allowed:
        return None

    result = (
        supabase.table("routing_profiles")
        .update(allowed)
        .eq("slug", slug)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result and result.data else None


def get_profile_by_slug(supabase, slug: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    # Try by slug first (existing behavior)
    query = supabase.table("routing_profiles").select("*").eq("slug", slug)
    if user_id:
        query = query.eq("user_id", user_id)
    result = query.limit(1).execute()

    if result and result.data:
        return result.data[0]

    # Fallback: try by name
    query = supabase.table("routing_profiles").select("*").eq("name", slug)
    if user_id:
        query = query.eq("user_id", user_id)
    result = query.limit(1).execute()

    return result.data[0] if result and result.data else None


def list_profiles(supabase, user_id: str) -> List[Dict[str, Any]]:
    result = (
        supabase.table("routing_profiles")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def routing_constraints_from_profile(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Extract routing constraints (allowed providers, limits) from a profile row."""
    graph_state = profile.get("graph_state") or {}
    providers = graph_state.get("providers") or []
    allowed_providers = [p.get("id") for p in providers if p.get("enabled", True)]
    limits = graph_state.get("hardLimits") or graph_state.get("hard_limits") or {}
    return {
        "allowed_providers": [p for p in allowed_providers if p],
        "hard_limits": limits,
    }


def _rules_to_text(rules: List[Dict[str, Any]]) -> str:
    if not rules:
        return "No special rules."
    lines = []
    for r in rules:
        name = r.get("name") or "Rule"
        cond = r.get("condition")
        op = r.get("operator")
        val = r.get("value")
        action = r.get("action")
        lines.append(f"- {name}: if {cond} {op} {val} then {action}")
    return "\n".join(lines)


async def route_with_profile(supabase, conversation: Union[str, List[Dict[str, Any]]], profile_slug: str) -> Optional[Dict[str, Any]]:
    """
    Profile-aware routing:
    - Calls Gemini to score prompt complexity, with rules embedded.
    - Respects provider enable/disable.
    - If the top model is blacklisted (disabled provider), pick the next best.
    """
    import asyncio

    def _get_profile():
        return get_profile_by_slug(supabase, profile_slug)

    profile = await asyncio.to_thread(_get_profile)
    if not profile:
        return None

    graph_state = normalize_graph_state(profile.get("graph_state") or {})
    allowed_providers = [p.get("id") for p in (graph_state.get("providers") or []) if p.get("enabled", True)]
    rules_text = _rules_to_text(graph_state.get("rules") or [])

    # Get LLM scores (Gemini) with rules context
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set for Gemini routing.")

    router_model = {
        "vendor": "google",
        "model_name": "gemini-2.0-flash-lite",
        "api_key": api_key,
    }

    prompt_text = base_router._conversation_to_prompt(conversation)
    system_prompt = f"""Rate this prompt with scores 0-10 (integers). Use these exact keys: overall_complexity, mathematical_and_logical_reasoning, linguistic_and_creative_reasoning, factuality, chain_of_thought_depth. Return ONLY valid JSON.

Routing rules:
{rules_text}

Prompt: {prompt_text}

JSON:"""

    payload = []
    if isinstance(conversation, list):
        payload.extend(conversation)
    payload.append({"role": "user", "content": system_prompt})

    response = await inference.call_google(router_model, payload)
    response_text = response["text"]
    match = _re.search(r"\{[^}]+\}", response_text, _re.DOTALL)
    if not match:
        raise ValueError(f"No JSON in Gemini response: {response_text}")
    normalized_scores = json.loads(match.group())

    best_model = None
    best_distance = float("inf")

    for vendor, vendor_data in MODELS.items():
        if allowed_providers and vendor not in allowed_providers:
            continue
        api_key_vendor = vendor_data["api_key"]
        for model_name, model_cfg in vendor_data["models"].items():
            attrs = model_cfg.get("capability_attributes", {})
            distance = base_router.calculate_model_score(normalized_scores, attrs)
            if distance < best_distance:
                best_distance = distance
                best_model = {
                    "vendor": vendor,
                    "model_name": model_name,
                    "api_key": api_key_vendor,
                    "config": model_cfg,
                    "score": attrs.get("overall_complexity", 0),
                    "llm_scores": normalized_scores,
                }

    return best_model


# ============================================
# COMMUNITY PROFILE FEATURES
# ============================================

def manage_profile_tags(supabase, profile_id: str, tag_ids: List[str]) -> None:
    """Update profile tag assignments. Replaces existing tags with new list."""
    # Delete existing tags
    supabase.table("profile_tag_assignments").delete().eq("profile_id", profile_id).execute()

    # Insert new tags
    if tag_ids:
        assignments = [{"profile_id": profile_id, "tag_id": tag_id} for tag_id in tag_ids]
        supabase.table("profile_tag_assignments").insert(assignments).execute()


def get_profile_tags(supabase, profile_id: str) -> List[Dict[str, Any]]:
    """Get all tags for a profile."""
    result = (
        supabase.table("profile_tag_assignments")
        .select("tag_id, profile_tags(*)")
        .eq("profile_id", profile_id)
        .execute()
    )
    return [item["profile_tags"] for item in (result.data or []) if item.get("profile_tags")]


def create_tag(supabase, name: str, category: str, user_id: str) -> Dict[str, Any]:
    """Create a custom tag."""
    payload = {
        "name": name,
        "category": category or "custom",
        "is_predefined": False,
        "created_by": user_id,
    }
    result = supabase.table("profile_tags").insert(payload).execute()
    return result.data[0]


def list_all_tags(supabase) -> List[Dict[str, Any]]:
    """List all tags (predefined + custom)."""
    result = supabase.table("profile_tags").select("*").order("category", desc=False).execute()
    return result.data or []


def rate_profile(supabase, profile_id: str, user_id: str, rating: int) -> Dict[str, Any]:
    """
    Rate a profile (1-5 stars). Upserts rating and recalculates avg_rating.
    Returns updated profile data with new avg_rating and rating_count.
    """
    # Upsert the rating
    rating_payload = {
        "profile_id": profile_id,
        "user_id": user_id,
        "rating": rating,
        "updated_at": "now()",
    }
    supabase.table("profile_ratings").upsert(rating_payload).execute()

    # Recalculate average rating
    ratings_result = supabase.table("profile_ratings").select("rating").eq("profile_id", profile_id).execute()
    ratings = [r["rating"] for r in (ratings_result.data or [])]

    avg_rating = sum(ratings) / len(ratings) if ratings else 0.0
    rating_count = len(ratings)

    # Update profile with new stats
    supabase.table("routing_profiles").update({
        "avg_rating": round(avg_rating, 1),
        "rating_count": rating_count,
    }).eq("id", profile_id).execute()

    return {
        "avg_rating": round(avg_rating, 1),
        "rating_count": rating_count,
    }


def get_profile_ratings_breakdown(supabase, profile_id: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Get rating breakdown for a profile."""
    # Get all ratings
    ratings_result = supabase.table("profile_ratings").select("rating").eq("profile_id", profile_id).execute()
    ratings = [r["rating"] for r in (ratings_result.data or [])]

    # Calculate distribution
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for rating in ratings:
        distribution[rating] = distribution.get(rating, 0) + 1

    # Get user's rating if provided
    user_rating = None
    if user_id:
        user_rating_result = (
            supabase.table("profile_ratings")
            .select("rating")
            .eq("profile_id", profile_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if user_rating_result.data:
            user_rating = user_rating_result.data[0]["rating"]

    avg_rating = sum(ratings) / len(ratings) if ratings else 0.0

    return {
        "avg_rating": round(avg_rating, 1),
        "rating_count": len(ratings),
        "distribution": distribution,
        "user_rating": user_rating,
    }


def track_profile_download(supabase, profile_id: str, user_id: str) -> None:
    """Track a profile download and increment download count."""
    # Log download
    supabase.table("profile_downloads").insert({
        "profile_id": profile_id,
        "user_id": user_id,
    }).execute()

    # Increment download count
    profile = supabase.table("routing_profiles").select("download_count").eq("id", profile_id).execute()
    current_count = profile.data[0]["download_count"] if profile.data else 0
    supabase.table("routing_profiles").update({
        "download_count": current_count + 1,
    }).eq("id", profile_id).execute()


def get_community_profiles(
    supabase,
    search: Optional[str] = None,
    tags: Optional[List[str]] = None,
    sort_by: str = "popular",
) -> List[Dict[str, Any]]:
    """
    Get all published community profiles with filtering and sorting.
    sort_by options: 'popular' (download_count), 'rating', 'newest', 'used' (total_tokens)
    """
    # Base query for published profiles
    query = supabase.table("routing_profiles").select(
        "id, slug, name, description, icon, author_name, download_count, avg_rating, rating_count, created_at, user_id"
    ).eq("published", True)

    # Apply search filter
    if search:
        query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%")

    # Apply sorting
    if sort_by == "rating":
        query = query.order("avg_rating", desc=True)
    elif sort_by == "newest":
        query = query.order("created_at", desc=True)
    elif sort_by == "used":
        # Note: total_tokens would require join with api_usage, simplified for now
        query = query.order("download_count", desc=True)
    else:  # default: popular
        query = query.order("download_count", desc=True)

    result = query.execute()
    profiles = result.data or []

    # Fetch tags for each profile
    for profile in profiles:
        profile_tags = get_profile_tags(supabase, profile["id"])
        profile["tags"] = profile_tags

    # Filter by tags if specified
    if tags:
        tag_set = set(tags)
        profiles = [
            p for p in profiles
            if any(tag["id"] in tag_set or tag["name"] in tag_set for tag in p.get("tags", []))
        ]

    return profiles


def get_profile_analytics(supabase, profile_id: str, user_id: str) -> Dict[str, Any]:
    """
    Get analytics for a profile owner.
    Returns global stats (downloads, ratings, total tokens) and personal usage stats.
    """
    # Get profile basic stats
    profile = supabase.table("routing_profiles").select("download_count, avg_rating, rating_count").eq("id", profile_id).execute()
    profile_data = profile.data[0] if profile.data else {}

    # Get total tokens from api_usage (global - all users who used this profile)
    # This requires profile_slug, so fetch it
    profile_full = supabase.table("routing_profiles").select("slug").eq("id", profile_id).execute()
    profile_slug = profile_full.data[0]["slug"] if profile_full.data else None

    total_tokens_global = 0
    if profile_slug:
        usage_result = supabase.table("api_usage").select("total_tokens").eq("profile_name", profile_slug).execute()
        usage_data = usage_result.data or []
        total_tokens_global = sum(item.get("total_tokens", 0) or 0 for item in usage_data)

    # Get personal usage (just this user's usage of this profile)
    total_tokens_personal = 0
    if profile_slug:
        personal_usage = (
            supabase.table("api_usage")
            .select("total_tokens")
            .eq("profile_name", profile_slug)
            .eq("user_id", user_id)
            .execute()
        )
        personal_data = personal_usage.data or []
        total_tokens_personal = sum(item.get("total_tokens", 0) or 0 for item in personal_data)

    return {
        "downloads": profile_data.get("download_count", 0),
        "avg_rating": profile_data.get("avg_rating", 0.0),
        "rating_count": profile_data.get("rating_count", 0),
        "total_tokens_global": total_tokens_global,
        "total_tokens_personal": total_tokens_personal,
    }
