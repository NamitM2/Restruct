"""
Model configuration for Restruct
Contains model metadata, API keys, and attributes for routing decisions

NORMALIZED VERSION: Scores spread across 1-10 range for better routing differentiation
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file (override=True ensures .env takes precedence)
load_dotenv(override=True)

null = None  # Python equivalent of JavaScript null
# Model metadata and configuration
MODELS = {
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY", "your-openai-key"),
        "models": {
            "gpt-5": {
                "input_token_cost": 1.25 / 1_000_000,
                "output_token_cost": 10.0 / 1_000_000,
                "max_tokens": 128000,
                "capability_attributes": {
                    "overall_complexity": 10.0,      # was 9.5 (highest)
                    "mathematical_and_logical_reasoning": 10.0,  # was 9.8 (highest)
                    "linguistic_and_creative_reasoning": 9.5,    # was 9.2
                    "factuality": 9.5,               # was 9.0
                    "chain_of_thought_depth": 9.4    # was 9.4
                }
            },

            "gpt-5-mini-nano": {
                "input_token_cost": 0.25 / 1_000_000,
                "output_token_cost": 2.0 / 1_000_000,
                "max_tokens": 128000,
                "capability_attributes": {
                    "overall_complexity": 5.7,       # was 8.4
                    "mathematical_and_logical_reasoning": 5.1,   # was 8.3
                    "linguistic_and_creative_reasoning": 6.2,    # was 8.5
                    "factuality": 5.7,               # was 8.2
                    "chain_of_thought_depth": 4.9    # was 8.0
                }
            }
        }
    },
    "google": {
        "api_key": os.getenv("GOOGLE_API_KEY", "your-google-key"),
        "models": {
            "gemini-2.5-pro": {
                "input_token_cost": 1.25 / 1_000_000,
                "output_token_cost": 10.0 / 1_000_000,
                "max_tokens": 1_000_000,
                "capability_attributes": {
                    "overall_complexity": 9.6,       # was 9.4
                    "mathematical_and_logical_reasoning": 9.0,   # was 9.5
                    "linguistic_and_creative_reasoning": 8.6,    # was 9.0
                    "factuality": 9.1,               # was 8.9
                    "chain_of_thought_depth": 9.4    # was 9.4
                }
            },
            "gemini-2.5-flash": {
                "input_token_cost": 0.30 / 1_000_000,
                "output_token_cost": 2.50 / 1_000_000,
                "max_tokens": 1_000_000,
                "capability_attributes": {
                    "overall_complexity": 6.9,       # was 8.7
                    "mathematical_and_logical_reasoning": 5.8,   # was 8.5
                    "linguistic_and_creative_reasoning": 7.1,    # was 8.7
                    "factuality": 6.2,               # was 8.3
                    "chain_of_thought_depth": 6.1    # was 8.4
                }
            },
            "gemini-2.5-flash-lite": {
                "input_token_cost": 0.10 / 1_000_000,
                "output_token_cost": 0.40 / 1_000_000,
                "max_tokens": 1_000_000,
                "capability_attributes": {
                    "overall_complexity": 2.6,       # was 7.6
                    "mathematical_and_logical_reasoning": 2.1,   # was 7.3
                    "linguistic_and_creative_reasoning": 2.9,    # was 7.8
                    "factuality": 2.4,               # was 7.5
                    "chain_of_thought_depth": 1.6    # was 7.0
                }
            },
            "gemini-2.0-flash": {
                "input_token_cost": 0.15 / 1_000_000,
                "output_token_cost": 0.60 / 1_000_000,
                "max_tokens": 512000,
                "capability_attributes": {
                    "overall_complexity": 4.1,       # was 8.0
                    "mathematical_and_logical_reasoning": 3.6,   # was 7.8
                    "linguistic_and_creative_reasoning": 4.2,    # was 8.0
                    "factuality": 4.0,               # was 7.8
                    "chain_of_thought_depth": 3.6    # was 7.6
                }
            },
            "gemini-2.0-flash-lite": {
                "input_token_cost": 0.05 / 1_000_000,
                "output_token_cost": 0.20 / 1_000_000,
                "max_tokens": 512000,
                "capability_attributes": {
                    "overall_complexity": 1.0,       # was 7.2 (lowest)
                    "mathematical_and_logical_reasoning": 1.0,   # was 7.0 (lowest)
                    "linguistic_and_creative_reasoning": 1.0,    # was 7.4 (lowest)
                    "factuality": 1.0,               # was 7.2 (lowest)
                    "chain_of_thought_depth": 1.0    # was 6.8 (lowest)
                }
            }
        }
    },
    "anthropic": {
        "api_key": os.getenv("ANTHROPIC_API_KEY", "your-anthropic-key"),
        "models": {
            "claude-opus-4.1": {
                "input_token_cost": 15.0 / 1_000_000,
                "output_token_cost": 75.0 / 1_000_000,
                "max_tokens": 200000,
                "capability_attributes": {
                    "overall_complexity": 9.1,       # was 9.3
                    "mathematical_and_logical_reasoning": 8.6,   # was 9.4
                    "linguistic_and_creative_reasoning": 10.0,   # was 9.3 (highest)
                    "factuality": 10.0,              # was 9.1 (highest)
                    "chain_of_thought_depth": 10.0   # was 9.6 (highest)
                }
            },
            "claude-sonnet-4.5": {
                "input_token_cost": 3.0 / 1_000_000,
                "output_token_cost": 15.0 / 1_000_000,
                "max_tokens": 200000,
                "capability_attributes": {
                    "overall_complexity": 8.0,       # was 9.0
                    "mathematical_and_logical_reasoning": 7.1,   # was 9.0
                    "linguistic_and_creative_reasoning": 9.0,    # was 9.1
                    "factuality": 8.4,               # was 8.8
                    "chain_of_thought_depth": 8.6    # was 9.2
                }
            },
            "claude-haiku-4.5": {
                "input_token_cost": 0.8 / 1_000_000,
                "output_token_cost": 4.0 / 1_000_000,
                "max_tokens": 200000,
                "capability_attributes": {
                    "overall_complexity": 4.1,       # was 8.0
                    "mathematical_and_logical_reasoning": 4.5,   # was 8.1
                    "linguistic_and_creative_reasoning": 8.4,    # was 9.0
                    "factuality": 7.1,               # was 8.5
                    "chain_of_thought_depth": 4.6    # was 7.8
                }
            }
        }
    }
}



def get_provider_key(provider: str) -> str:
    """Get API key for a specific provider."""
    return MODELS.get(provider, {}).get("api_key")
