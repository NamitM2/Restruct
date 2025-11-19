"""
Router: selects the best model based on complexity.
MVP: picks model with highest overall_complexity.
No classes, just functions.
"""

from typing import Dict, Any
import json
import re
import os
from backend_code.models_config import MODELS
from backend_code.inference import call_google


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


def route_with_gemini(prompt: str) -> Dict[str, float]:
    """Obtain routing scores using Gemini via the shared inference helper."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set for Gemini routing.")

    router_model = {
        "vendor": "google",
        "model_name": "gemini-2.0-flash-lite",
        "api_key": api_key,
    }

    system_prompt = f"""Rate this prompt with scores 0-10 (integers). Use these exact keys: overall_complexity, mathematical_and_logical_reasoning, linguistic_and_creative_reasoning, factuality, chain_of_thought_depth. Return ONLY valid JSON.

Prompt: {prompt}

JSON:"""

    response = call_google(router_model, system_prompt)
    response_text = response["text"]
    match = re.search(r"\{[^}]+\}", response_text, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON in Gemini response: {response_text}")

    return json.loads(match.group())


def route_with_phi(prompt: str) -> Dict[str, float]:
    """Obtain routing scores using the local Phi router."""
    from backend_code.local_llm_router import get_local_router

    router = get_local_router()
    if not router.has_gpu():
        raise RuntimeError("Local GPU router unavailable.")
    return router.assess_prompt(prompt)


def route_with_llm(prompt: str) -> Dict[str, Any]:
    """Route using local Phi router if available, otherwise Gemini API."""
    normalized_scores = None
    routing_model = None
    try:
        from backend_code.local_llm_router import get_local_router
        router = get_local_router()
        normalized_scores = route_with_phi(prompt)
        routing_model = "phi"
    except Exception as e:
        normalized_scores = route_with_gemini(prompt)
        routing_model = "gemini"

    print(f"routing with {routing_model}")

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
