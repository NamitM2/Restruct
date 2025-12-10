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
) -> Dict[str, Any]:
    payload = {
        "user_id": user_id,
        "name": name,
        "description": description,
        "graph_state": normalize_graph_state(graph_state),
        "slug": slugify(name),
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
    query = supabase.table("routing_profiles").select("*").eq("slug", slug)
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
