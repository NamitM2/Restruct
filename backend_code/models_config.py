"""
Model configuration for Restruct
Contains model metadata, API keys, and attributes for routing decisions.

NORMALIZED VERSION: Scores are 1–10 for better routing differentiation.
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv(override=True)

null = None

MODELS = {
    # ============================================================================================
    # OPENAI MODELS (CORRECTED NAMES — ONLY WORKING MODELS)
    # ============================================================================================
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY", "your-openai-key"),
        "models": {

            # ------------------------------------------------------------------------------------
            # GPT-5 (flagship)
            # ------------------------------------------------------------------------------------
            "gpt-5": {
                "input_token_cost": 1.25 / 1_000_000,
                "output_token_cost": 10.0 / 1_000_000,
                "max_tokens": 128_000,
                "capability_attributes": {
                    "overall_complexity": 10.0,
                    "mathematical_and_logical_reasoning": 10.0,
                    "linguistic_and_creative_reasoning": 9.5,
                    "factuality": 9.5,
                    "chain_of_thought_depth": 9.4
                }
            },

            # ------------------------------------------------------------------------------------
            # GPT-5-Mini (mid-tier)
            # ------------------------------------------------------------------------------------
            "gpt-5-mini": {
                "input_token_cost": 0.60 / 1_000_000,
                "output_token_cost": 4.5 / 1_000_000,
                "max_tokens": 128_000,
                "capability_attributes": {
                    "overall_complexity": 7.1,
                    "mathematical_and_logical_reasoning": 6.8,
                    "linguistic_and_creative_reasoning": 7.4,
                    "factuality": 7.1,
                    "chain_of_thought_depth": 6.6
                }
            },

            # ------------------------------------------------------------------------------------
            # GPT-5-Nano (lightest tier)
            # ------------------------------------------------------------------------------------
            "gpt-5-nano": {
                "input_token_cost": 0.25 / 1_000_000,
                "output_token_cost": 2.0 / 1_000_000,
                "max_tokens": 128_000,
                "capability_attributes": {
                    "overall_complexity": 5.7,
                    "mathematical_and_logical_reasoning": 5.1,
                    "linguistic_and_creative_reasoning": 6.2,
                    "factuality": 5.7,
                    "chain_of_thought_depth": 4.9
                }
            },
        }
    },

    # ============================================================================================
    # GOOGLE GEMINI MODELS
    # ============================================================================================
    "google": {
        "api_key": os.getenv("GOOGLE_API_KEY", "your-google-key"),
        "models": {
            "gemini-2.5-pro": {
                "input_token_cost": 1.25 / 1_000_000,
                "output_token_cost": 5.00 / 1_000_000,
                "max_tokens": 1_000_000,
                "capability_attributes": {
                    "overall_complexity": 9.6,
                    "mathematical_and_logical_reasoning": 9.0,
                    "linguistic_and_creative_reasoning": 8.6,
                    "factuality": 9.1,
                    "chain_of_thought_depth": 9.4
                }
            },
            "gemini-2.5-flash": {
                "input_token_cost": 0.075 / 1_000_000,
                "output_token_cost": 0.30 / 1_000_000,
                "max_tokens": 1_000_000,
                "capability_attributes": {
                    "overall_complexity": 6.9,
                    "mathematical_and_logical_reasoning": 5.8,
                    "linguistic_and_creative_reasoning": 7.1,
                    "factuality": 6.2,
                    "chain_of_thought_depth": 6.1
                }
            },
            "gemini-2.0-flash": {
                "input_token_cost": 0.0375 / 1_000_000,
                "output_token_cost": 0.15 / 1_000_000,
                "max_tokens": 1_000_000,
                "capability_attributes": {
                    "overall_complexity": 4.1,
                    "mathematical_and_logical_reasoning": 3.6,
                    "linguistic_and_creative_reasoning": 4.2,
                    "factuality": 4.0,
                    "chain_of_thought_depth": 3.6
                }
            }
        }
    },

    # ============================================================================================
    # ANTHROPIC CLAUDE MODELS
    # ============================================================================================
    "anthropic": {
        "api_key": os.getenv("ANTHROPIC_API_KEY", "your-anthropic-key"),
        "models": {
            "claude-opus-4-1": {
                "input_token_cost": 15.0 / 1_000_000,
                "output_token_cost": 75.0 / 1_000_000,
                "max_tokens": 200_000,
                "capability_attributes": {
                    "overall_complexity": 9.1,
                    "mathematical_and_logical_reasoning": 8.6,
                    "linguistic_and_creative_reasoning": 10.0,
                    "factuality": 10.0,
                    "chain_of_thought_depth": 10.0
                }
            },
            "claude-sonnet-4-5": {
                "input_token_cost": 3.0 / 1_000_000,
                "output_token_cost": 15.0 / 1_000_000,
                "max_tokens": 200_000,
                "capability_attributes": {
                    "overall_complexity": 8.0,
                    "mathematical_and_logical_reasoning": 7.1,
                    "linguistic_and_creative_reasoning": 9.0,
                    "factuality": 8.4,
                    "chain_of_thought_depth": 8.6
                }
            },
            "claude-haiku-4-5": {
                "input_token_cost": 0.8 / 1_000_000,
                "output_token_cost": 4.0 / 1_000_000,
                "max_tokens": 200_000,
                "capability_attributes": {
                    "overall_complexity": 4.1,
                    "mathematical_and_logical_reasoning": 4.5,
                    "linguistic_and_creative_reasoning": 8.4,
                    "factuality": 7.1,
                    "chain_of_thought_depth": 4.6
                }
            }
        }
    }
}


def get_provider_key(provider: str) -> str:
    """Get API key for a specific provider."""
    return MODELS.get(provider, {}).get("api_key")
