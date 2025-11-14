"""
Router: selects the best model based on complexity.
MVP: picks model with highest overall_complexity.
No classes, just functions.
"""

from typing import Dict, Any
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


def route_with_llm(prompt: str) -> Dict[str, Any]:
    """Route by asking Gemini 2.5 Flash Lite to assess prompt difficulty."""
    from backend_code.inference import inference as run_inference
    import json
    import re

    google_cfg = MODELS.get("google")
    if not google_cfg:
        raise ValueError("Google provider configuration missing.")

    gemini_cfg = google_cfg["models"].get("gemini-2.5-flash-lite")
    if not gemini_cfg:
        raise ValueError("Gemini 2.5 Flash Lite configuration missing.")

    assessment_model = {
        "vendor": "google",
        "model_name": "gemini-2.5-flash-lite",
        "api_key": google_cfg["api_key"],
        "config": gemini_cfg,
        "score": gemini_cfg.get("capability_attributes", {}).get("overall_complexity", 0),
    }

    rating_prompt = (
        "You are an expert routing assistant that estimates how demanding prompts are.\n"
        "Score the user's prompt from 1-10 (inclusive, numbers only) for the following keys:\n"
        "overall_complexity, mathematical_and_logical_reasoning, linguistic_and_creative_reasoning, "
        "factuality, chain_of_thought_depth.\n"
        "Return only minified JSON with exactly those keys and numeric values.\n\n"
        f"User prompt:\n{prompt}\n"
    )

    llm_response = run_inference(assessment_model, rating_prompt)
    match = re.search(r"\{.*\}", llm_response, re.DOTALL)
    if not match:
        return select_model(prompt), {}

    raw_scores = json.loads(match.group())
    dimensions = [
        "overall_complexity",
        "mathematical_and_logical_reasoning",
        "linguistic_and_creative_reasoning",
        "factuality",
        "chain_of_thought_depth",
    ]

    normalized_scores = {}
    for dim in dimensions:
        value = raw_scores.get(dim)
        if value is None:
            normalized_scores[dim] = 0.0
            continue
        normalized_value = float(value)
        normalized_scores[dim] = max(1.0, min(10.0, normalized_value))

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

    print(model_scores)
    return best_model, model_scores


def route_specific(provider: str, model_name: str) -> Dict[str, Any]:
    """Expose explicit provider/model selection."""
    return select_specific_model(provider, model_name)
