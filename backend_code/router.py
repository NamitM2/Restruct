"""
Router: selects the best model based on complexity.
MVP: picks model with highest overall_complexity.
No classes, just functions.
"""

from typing import Dict, Any
import json
import re
import os
import google.generativeai as genai
from backend_code.models_config import MODELS


def select_model(prompt: str) -> Dict[str, Any]:
    """
    Select best model based on overall_complexity.

    Args:
        prompt: User's prompt

    Returns:
        {
            "vendor": str,
            "model_name": str,
            "api_key": str,
            "config": dict,
            "score": float
        }
    """
    models_config = MODELS

    best = None
    best_score = -1.0

    for vendor, vendor_data in models_config.items():
        api_key = vendor_data["api_key"]

        for model_name, model_cfg in vendor_data["models"].items():
            attrs = model_cfg.get("capability_attributes", {})
            score = attrs.get("overall_complexity", 0)

            if score > best_score:
                best_score = score
                best = {
                    "vendor": vendor,
                    "model_name": model_name,
                    "api_key": api_key,
                    "config": model_cfg,
                    "score": best_score
                }

    return best


def select_specific_model(provider: str, model_name: str) -> Dict[str, Any]:
    """
    Build a model choice payload for an explicit provider/model combination.

    Raises:
        ValueError: when provider or model cannot be found.
    """
    provider = provider.lower()
    vendor_config = MODELS.get(provider)
    if not vendor_config:
        raise ValueError(f"Unknown provider '{provider}'.")

    model_config = vendor_config["models"].get(model_name)
    if not model_config:
        raise ValueError(f"Unknown model '{model_name}' for provider '{provider}'.")

    api_key = vendor_config["api_key"]
    attrs = model_config.get("capability_attributes", {})
    score = attrs.get("overall_complexity", 0)

    return {
        "vendor": provider,
        "model_name": model_name,
        "api_key": api_key,
        "config": model_config,
        "score": score,
    }



def route(prompt: str) -> Dict[str, Any]:
    """Main routing function."""
    return select_model(prompt)


def calculate_model_score(prompt_attrs: Dict[str, float], model_attrs: Dict[str, float]) -> float:
    """Return squared distance between prompt attributes and a model."""
    distance = 0.0
    for key, prompt_value in prompt_attrs.items():
        model_value = model_attrs.get(key, 0)
        diff = model_value - prompt_value
        distance += diff * diff
    return distance


def route_with_gemini_api(prompt: str) -> Dict[str, Any]:
    """Route using Gemini 2.0 Flash Lite API to assess prompt difficulty."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("GOOGLE_API_KEY not set, falling back to simple routing...")
        return select_model(prompt), {}

    system_prompt = f"""Rate this prompt with scores 0-10 (integers). Use these exact keys: overall_complexity, mathematical_and_logical_reasoning, linguistic_and_creative_reasoning, factuality, chain_of_thought_depth. Return ONLY valid JSON.

Prompt: {prompt}

JSON:"""

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash-lite",
            contents=system_prompt
        )

        response_text = response.text
        match = re.search(r'\{[^}]+\}', response_text, re.DOTALL)
        if not match:
            raise ValueError(f"No JSON in Gemini response: {response_text}")

        normalized_scores = json.loads(match.group())

    except Exception as e:
        print(f"Gemini API routing failed: {e}")
        print("Falling back to simple routing...")
        return select_model(prompt), {}

    best_model = None
    best_distance = float("inf")
    model_scores = {}

    for vendor, vendor_data in MODELS.items():
        api_key = vendor_data["api_key"]
        for model_name, model_cfg in vendor_data["models"].items():
            attrs = model_cfg.get("capability_attributes", {})
            distance = calculate_model_score(normalized_scores, attrs)
            model_scores[f"{vendor}:{model_name}"] = distance
            if distance < best_distance:
                best_distance = distance
                best_model = {
                    "vendor": vendor,
                    "model_name": model_name,
                    "api_key": api_key,
                    "config": model_cfg,
                    "score": attrs.get("overall_complexity", 0),
                    "llm_scores": normalized_scores,
                }

    return best_model, model_scores


def route_with_llm(prompt: str) -> Dict[str, Any]:
    """Route using local GPU model if available, otherwise Gemini API."""
    from backend_code.local_llm_router import get_local_router

    router = get_local_router()

    if not router.has_gpu():
        return route_with_gemini_api(prompt)

    try:
        normalized_scores = router.assess_prompt(prompt)
    except Exception as e:
        print(f"Local LLM routing failed: {e}")
        print("Falling back to Gemini API routing...")
        return route_with_gemini_api(prompt)

    best_model = None
    best_distance = float("inf")
    model_scores = {}

    for vendor, vendor_data in MODELS.items():
        api_key = vendor_data["api_key"]
        for model_name, model_cfg in vendor_data["models"].items():
            attrs = model_cfg.get("capability_attributes", {})
            distance = calculate_model_score(normalized_scores, attrs)
            model_scores[f"{vendor}:{model_name}"] = distance
            if distance < best_distance:
                best_distance = distance
                best_model = {
                    "vendor": vendor,
                    "model_name": model_name,
                    "api_key": api_key,
                    "config": model_cfg,
                    "score": attrs.get("overall_complexity", 0),
                    "llm_scores": normalized_scores,
                }

    return best_model, model_scores


def route_specific(provider: str, model_name: str) -> Dict[str, Any]:
    """Expose explicit provider/model selection."""
    return select_specific_model(provider, model_name)
