"""
Model configuration for Restruct
Contains model metadata, API keys, and attributes for routing decisions
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
                "input_token_cost": 1.25 / 1_000_000,     # $1.25 per 1M input tokens :contentReference[oaicite:0]{index=0}
                "output_token_cost": 10.0 / 1_000_000,     # $10 per 1M output tokens :contentReference[oaicite:1]{index=1}
                "max_tokens": 128000,                     # from context window comment for GPT-5 :contentReference[oaicite:2]{index=2}
                "capability_attributes": {
                    "overall_complexity": 9.5,
                    "mathematical_and_logical_reasoning": 9.8,
                    "linguistic_and_creative_reasoning": 9.2,
                    "factuality": 9.0,
                    "chain_of_thought_depth": 9.4
                }
            },
            
#            "gpt-5-pro": {
#                "input_token_cost": null,   # no public exact API cost found 
#                "output_token_cost": null,
#                "max_tokens": 128000,       # assume same as flagship 
#                "capability_attributes": {
#                    "overall_complexity": 9.7,
#                    "mathematical_and_logical_reasoning": 9.9,
#                    "linguistic_and_creative_reasoning": 9.0,
#                    "factuality": 9.2,
#                    "chain_of_thought_depth": 9.8
#                }
#            },
            
            "gpt-5_mini_nano": {
                "input_token_cost": 0.25 / 1_000_000,     # $0.25 per 1M input tokens (mini) :contentReference[oaicite:3]{index=3}
                "output_token_cost": 2.0 / 1_000_000,     # $2 per 1M output tokens (mini) :contentReference[oaicite:4]{index=4}
                "max_tokens": 128000,                     # assume same model window
                "capability_attributes": {
                    "overall_complexity": 8.4,
                    "mathematical_and_logical_reasoning": 8.3,
                    "linguistic_and_creative_reasoning": 8.5,
                    "factuality": 8.2,
                    "chain_of_thought_depth": 8.0
                }
            }
        }
    },
    "google": {
        "api_key": os.getenv("GOOGLE_API_KEY", "your-google-key"),
        "models": {
            "gemini-2.5_pro": {
                "input_token_cost": 1.25 / 1_000_000,  # $1.25 per 1M input (<=200k tokens) :contentReference[oaicite:5]{index=5}
                "output_token_cost": 10.0 / 1_000_000, # $10 per 1M output tokens :contentReference[oaicite:6]{index=6}
                "max_tokens": 1_000_000,               # 1M token context window :contentReference[oaicite:7]{index=7}
                "capability_attributes": {
                    "overall_complexity": 9.4,
                    "mathematical_and_logical_reasoning": 9.5,
                    "linguistic_and_creative_reasoning": 9.0,
                    "factuality": 8.9,
                    "chain_of_thought_depth": 9.4
                }
            },
            "gemini-2.5-flash": {
                "input_token_cost": 0.30 / 1_000_000,  # ~$0.30 per 1M input tokens :contentReference[oaicite:8]{index=8}
                "output_token_cost": 2.50 / 1_000_000, # ~$2.50 per 1M output tokens :contentReference[oaicite:9]{index=9}
                "max_tokens": 1_000_000,               # assume same window
                "capability_attributes": {
                    "overall_complexity": 8.7,
                    "mathematical_and_logical_reasoning": 8.5,
                    "linguistic_and_creative_reasoning": 8.7,
                    "factuality": 8.3,
                    "chain_of_thought_depth": 8.4
                }
            },
            "gemini-2.5-flash-lite": {
                "input_token_cost": 0.10 / 1_000_000,  # $0.10 per 1M input tokens :contentReference[oaicite:10]{index=10}
                "output_token_cost": 0.40 / 1_000_000, # $0.40 per 1M output tokens :contentReference[oaicite:11]{index=11}
                "max_tokens": 1_000_000,               # consistent assumption
                "capability_attributes": {
                    "overall_complexity": 7.6,
                    "mathematical_and_logical_reasoning": 7.3,
                    "linguistic_and_creative_reasoning": 7.8,
                    "factuality": 7.5,
                    "chain_of_thought_depth": 7.0
                }
            },
            "gemini-2.0-flash": {
                "input_token_cost": 0.15 / 1_000_000,   # ~$0.15 per 1M input tokens :contentReference[oaicite:12]{index=12}
                "output_token_cost": 0.60 / 1_000_000,  # ~$0.60 per 1M output tokens :contentReference[oaicite:13]{index=13}
                "max_tokens": 512000,                   # estimate (less than 2.5 series)
                "capability_attributes": {
                    "overall_complexity": 8.0,
                    "mathematical_and_logical_reasoning": 7.8,
                    "linguistic_and_creative_reasoning": 8.0,
                    "factuality": 7.8,
                    "chain_of_thought_depth": 7.6
                }
            },
            "gemini-2.0-flash-lite": {
                "input_token_cost": 0.05 / 1_000_000,   # ~$0.05 per 1M input tokens (estimate) :contentReference[oaicite:14]{index=14}
                "output_token_cost": 0.20 / 1_000_000,  # ~$0.20 per 1M output tokens (estimate) :contentReference[oaicite:15]{index=15}
                "max_tokens": 512000,
                "capability_attributes": {
                    "overall_complexity": 7.2,
                    "mathematical_and_logical_reasoning": 7.0,
                    "linguistic_and_creative_reasoning": 7.4,
                    "factuality": 7.2,
                    "chain_of_thought_depth": 6.8
                }
            }
        }
    },
    "anthropic": {
        "api_key": os.getenv("ANTHROPIC_API_KEY", "your-anthropic-key"),
        "models": {
            "claude-opus_4.1": {
                "input_token_cost": 15.0 / 1_000_000,   # $15 per 1M input tokens :contentReference[oaicite:16]{index=16}
                "output_token_cost": 75.0 / 1_000_000,  # $75 per 1M output tokens :contentReference[oaicite:17]{index=17}
                "max_tokens": 200000,                   # 200k input tokens context window :contentReference[oaicite:18]{index=18}
                "capability_attributes": {
                    "overall_complexity": 9.3,
                    "mathematical_and_logical_reasoning": 9.4,
                    "linguistic_and_creative_reasoning": 9.3,
                    "factuality": 9.1,
                    "chain_of_thought_depth": 9.6
                }
            },
            "claude-sonnet_4.5": {
                "input_token_cost": 3.0 / 1_000_000,    # ~$3 input / $15 output per million tokens :contentReference[oaicite:19]{index=19}
                "output_token_cost": 15.0 / 1_000_000,  # :contentReference[oaicite:20]{index=20}
                "max_tokens": 200000,                   # assume same context window
                "capability_attributes": {
                    "overall_complexity": 9.0,
                    "mathematical_and_logical_reasoning": 9.0,
                    "linguistic_and_creative_reasoning": 9.1,
                    "factuality": 8.8,
                    "chain_of_thought_depth": 9.2
                }
            },
            "claude-haiku_4.5": {
                "input_token_cost": 0.8 / 1_000_000,    # ~$0.80 input / ~$4 output per million tokens :contentReference[oaicite:21]{index=21}
                "output_token_cost": 4.0 / 1_000_000,   # :contentReference[oaicite:22]{index=22}
                "max_tokens": 200000,                   # assume same context window
                "capability_attributes": {
                    "overall_complexity": 8.0,
                    "mathematical_and_logical_reasoning": 8.1,
                    "linguistic_and_creative_reasoning": 9.0,
                    "factuality": 8.5,
                    "chain_of_thought_depth": 7.8
                }
            }
        }
    }
}



def get_provider_key(provider: str) -> str:
    """Get API key for a specific provider."""
    return MODELS.get(provider, {}).get("api_key")
