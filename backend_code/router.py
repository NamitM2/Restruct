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


def route_specific(provider: str, model_name: str) -> Dict[str, Any]:
    """Expose explicit provider/model selection."""
    return select_specific_model(provider, model_name)
