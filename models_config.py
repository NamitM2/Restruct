"""
Model configuration for Restruct
Contains model metadata, API keys, and attributes for routing decisions
"""

import os
from typing import Dict, Any

# Model metadata and configuration
MODELS = {
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY", "your-openai-key"),
        "models": {
            "gpt-3.5-turbo": {
                "cost": 0.0015,  # Cost per 1K tokens
                "performance": 0.7,  # Performance score (0-1)
                "max_tokens": 4096,
                "description": "Fast and cost-effective for simple tasks"
            },
            "gpt-4-turbo": {
                "cost": 0.01,
                "performance": 0.95,
                "max_tokens": 128000,
                "description": "High performance for complex reasoning"
            },
            "gpt-4o": {
                "cost": 0.005,
                "performance": 0.92,
                "max_tokens": 128000,
                "description": "Balanced performance and cost"
            }
        }
    },
    "google": {
        "api_key": os.getenv("GOOGLE_API_KEY", "your-google-key"),
        "models": {
            "gemini-1.5-pro": {
                "cost": 0.006,
                "performance": 0.9,
                "max_tokens": 1000000,
                "description": "Excellent for long context tasks"
            },
            "gemini-1.5-flash": {
                "cost": 0.0002,
                "performance": 0.75,
                "max_tokens": 1000000,
                "description": "Ultra-fast and cost-effective"
            }
        }
    },
    "anthropic": {
        "api_key": os.getenv("ANTHROPIC_API_KEY", "your-anthropic-key"),
        "models": {
            "claude-3-opus": {
                "cost": 0.015,
                "performance": 0.98,
                "max_tokens": 200000,
                "description": "Top-tier reasoning and analysis"
            },
            "claude-3-sonnet": {
                "cost": 0.003,
                "performance": 0.88,
                "max_tokens": 200000,
                "description": "Balanced intelligence and speed"
            },
            "claude-3-haiku": {
                "cost": 0.00025,
                "performance": 0.72,
                "max_tokens": 200000,
                "description": "Fast and affordable"
            }
        }
    }
}


def get_all_models() -> Dict[str, Dict[str, Any]]:
    """
    Get a flattened dictionary of all available models
    Returns: {model_name: {provider, cost, performance, ...}}
    """
    all_models = {}
    for provider, provider_data in MODELS.items():
        for model_name, model_attrs in provider_data["models"].items():
            all_models[model_name] = {
                "provider": provider,
                "api_key": provider_data["api_key"],
                **model_attrs
            }
    return all_models


def get_model_info(model_name: str) -> Dict[str, Any]:
    """Get information about a specific model"""
    all_models = get_all_models()
    return all_models.get(model_name)


def get_provider_key(provider: str) -> str:
    """Get API key for a specific provider"""
    return MODELS.get(provider, {}).get("api_key")
