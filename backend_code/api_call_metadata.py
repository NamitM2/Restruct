"""
API Call Metadata Helpers

This module provides helper functions for extracting and formatting metadata
from API calls, routing decisions, and LLM responses. These functions help
the frontend display real-time status updates and cost information.
"""

from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
import time


@dataclass
class RoutingResult:
    """Container for routing decision metadata."""
    model_name: str
    provider: str
    score: float
    routing_time_ms: float
    routing_model: str  # "gemini" or "phi"
    llm_scores: Optional[Dict[str, float]] = None
    all_model_scores: Optional[Dict[str, float]] = None


@dataclass
class InferenceResult:
    """Container for inference response metadata."""
    text: str
    input_tokens: int
    output_tokens: int
    inference_time_ms: float
    model_name: str
    provider: str


@dataclass
class CostBreakdown:
    """Container for cost calculation details."""
    input_tokens: int
    output_tokens: int
    input_cost_per_token: float
    output_cost_per_token: float
    input_cost_total: float
    output_cost_total: float
    total_cost: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "input_cost_per_token": self.input_cost_per_token,
            "output_cost_per_token": self.output_cost_per_token,
            "input_cost_total": self.input_cost_total,
            "output_cost_total": self.output_cost_total,
            "total_cost": self.total_cost,
            "total_cost_formatted": f"${self.total_cost:.6f}"
        }


# ============================================================================
# COST CALCULATION FUNCTIONS
# ============================================================================

def calculate_api_cost(
    input_tokens: int,
    output_tokens: int,
    model_config: Dict[str, Any]
) -> CostBreakdown:
    """
    Calculate the cost breakdown for an API call.
    
    Args:
        input_tokens: Number of input tokens used
        output_tokens: Number of output tokens generated
        model_config: Model configuration dict containing cost information
        
    Returns:
        CostBreakdown object with detailed cost information
        
    Example:
        >>> config = {"input_token_cost": 0.000001, "output_token_cost": 0.000002}
        >>> cost = calculate_api_cost(1000, 500, config)
        >>> print(cost.total_cost)
        0.002
    """
    input_cost_per_token = model_config.get("input_token_cost", 0.0)
    output_cost_per_token = model_config.get("output_token_cost", 0.0)
    
    input_cost_total = input_tokens * input_cost_per_token
    output_cost_total = output_tokens * output_cost_per_token
    total_cost = input_cost_total + output_cost_total
    
    return CostBreakdown(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_cost_per_token=input_cost_per_token,
        output_cost_per_token=output_cost_per_token,
        input_cost_total=input_cost_total,
        output_cost_total=output_cost_total,
        total_cost=total_cost
    )


def estimate_cost_for_model(
    estimated_input_tokens: int,
    estimated_output_tokens: int,
    provider: str,
    model_name: str
) -> Optional[CostBreakdown]:
    """
    Estimate cost for a specific model before making the API call.
    
    Args:
        estimated_input_tokens: Estimated number of input tokens
        estimated_output_tokens: Estimated number of output tokens
        provider: Provider name (e.g., "openai", "google", "anthropic")
        model_name: Model name (e.g., "gpt-5", "gemini-2.5-pro")
        
    Returns:
        CostBreakdown object or None if model not found
    """
    from backend_code.models_config import MODELS
    
    vendor_config = MODELS.get(provider)
    if not vendor_config:
        return None
    
    model_config = vendor_config.get("models", {}).get(model_name)
    if not model_config:
        return None
    
    return calculate_api_cost(
        estimated_input_tokens,
        estimated_output_tokens,
        model_config
    )


# ============================================================================
# ROUTING STATUS FUNCTIONS
# ============================================================================

def create_routing_complete_event(
    model_choice: Dict[str, Any],
    routing_time_seconds: float,
    routing_model: str = "gemini"
) -> Dict[str, Any]:
    """
    Create a routing completion event for the frontend.
    
    This event signals that routing is complete and the system is now
    waiting for the LLM response. The frontend can use this to switch
    from "Routing..." to showing the model logo and "Thinking...".
    
    Args:
        model_choice: Model selection dict from router
        routing_time_seconds: Time taken for routing in seconds
        routing_model: Which model was used for routing ("gemini" or "phi")
        
    Returns:
        Dict containing routing completion metadata
        
    Example:
        >>> event = create_routing_complete_event(model_choice, 0.234)
        >>> print(event["status"])
        "routing_complete"
        >>> print(event["selected_model"]["provider"])
        "openai"
    """
    return {
        "status": "routing_complete",
        "timestamp": time.time(),
        "routing_time_ms": round(routing_time_seconds * 1000, 2),
        "routing_model": routing_model,
        "selected_model": {
            "provider": model_choice["vendor"],
            "model_name": model_choice["model_name"],
            "score": model_choice.get("score", 0),
            "complexity_score": model_choice.get("score", 0)
        },
        "routing_metadata": {
            "llm_scores": model_choice.get("llm_scores"),
            "all_scores": model_choice.get("all_scores")
        }
    }


def create_inference_start_event(
    model_choice: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create an inference start event for the frontend.
    
    This event signals that the LLM inference has started.
    
    Args:
        model_choice: Model selection dict from router
        
    Returns:
        Dict containing inference start metadata
    """
    return {
        "status": "inference_started",
        "timestamp": time.time(),
        "model": {
            "provider": model_choice["vendor"],
            "model_name": model_choice["model_name"]
        }
    }


def create_inference_complete_event(
    response_text: str,
    model_choice: Dict[str, Any],
    response_data: Dict[str, Any],
    routing_time_seconds: float,
    inference_time_seconds: float,
    routing_model: str = "gemini"
) -> Dict[str, Any]:
    """
    Create a complete response event with all metadata.
    
    This is the final event sent to the frontend containing the LLM response
    and all associated metadata (costs, timing, tokens, etc.).
    
    Args:
        response_text: The LLM's response text
        model_choice: Model selection dict from router
        response_data: Response data from inference (contains tokens)
        routing_time_seconds: Time taken for routing
        inference_time_seconds: Time taken for inference
        routing_model: Which model was used for routing
        
    Returns:
        Dict containing complete response metadata
    """
    input_tokens = response_data.get("input_tokens", 0)
    output_tokens = response_data.get("output_tokens", 0)
    
    cost_breakdown = calculate_api_cost(
        input_tokens,
        output_tokens,
        model_choice["config"]
    )
    
    # Convert to milliseconds for frontend (but use field names frontend expects)
    routing_time_ms = round(routing_time_seconds * 1000, 2)
    inference_time_ms = round(inference_time_seconds * 1000, 2)
    
    return {
        "status": "complete",
        "timestamp": time.time(),
        "output": response_text,
        "model": model_choice["model_name"],
        "provider": model_choice["vendor"],
        "routing_metadata": {
            "score": model_choice.get("score", 0),
            "routing_model": routing_model,
            "llm_scores": model_choice.get("llm_scores")
        },
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": cost_breakdown.total_cost,
            "cost_breakdown": cost_breakdown.to_dict()
        },
        "timing": {
            "routing_time": routing_time_ms,  # Frontend expects this name
            "inference_time": inference_time_ms,  # Frontend expects this name
            "total_time_ms": round((routing_time_seconds + inference_time_seconds) * 1000, 2)
        }
    }


# ============================================================================
# MODEL INFORMATION EXTRACTION
# ============================================================================

def get_model_display_info(provider: str, model_name: str) -> Dict[str, Any]:
    """
    Get display information for a model (logo, name, etc.).
    
    Args:
        provider: Provider name (e.g., "openai", "google", "anthropic")
        model_name: Model name (e.g., "gpt-5", "gemini-2.5-pro")
        
    Returns:
        Dict containing display information
        
    Example:
        >>> info = get_model_display_info("openai", "gpt-5")
        >>> print(info["display_name"])
        "GPT-5"
        >>> print(info["provider_display"])
        "OpenAI"
    """
    provider_display_names = {
        "openai": "OpenAI",
        "google": "Google",
        "anthropic": "Anthropic"
    }
    
    # Model display name formatting
    display_name = model_name.upper() if provider == "openai" else model_name.title()
    
    # Provider logo/icon mapping (can be extended with actual logo URLs)
    provider_logos = {
        "openai": "/assets/logos/openai.svg",
        "google": "/assets/logos/google.svg",
        "anthropic": "/assets/logos/anthropic.svg"
    }
    
    return {
        "provider": provider,
        "model_name": model_name,
        "display_name": display_name,
        "provider_display": provider_display_names.get(provider, provider.title()),
        "logo_url": provider_logos.get(provider, "/assets/logos/default.svg"),
        "full_name": f"{provider_display_names.get(provider, provider.title())} {display_name}"
    }


def extract_model_capabilities(model_choice: Dict[str, Any]) -> Dict[str, float]:
    """
    Extract capability attributes from a model choice.
    
    Args:
        model_choice: Model selection dict from router
        
    Returns:
        Dict of capability attributes
    """
    config = model_choice.get("config", {})
    return config.get("capability_attributes", {})


def get_model_max_tokens(provider: str, model_name: str) -> int:
    """
    Get the maximum token limit for a model.
    
    Args:
        provider: Provider name
        model_name: Model name
        
    Returns:
        Maximum token limit, or 0 if not found
    """
    from backend_code.models_config import MODELS
    
    vendor_config = MODELS.get(provider)
    if not vendor_config:
        return 0
    
    model_config = vendor_config.get("models", {}).get(model_name)
    if not model_config:
        return 0
    
    return model_config.get("max_tokens", 0)


# ============================================================================
# TOKEN ESTIMATION FUNCTIONS
# ============================================================================

def estimate_tokens(text: str) -> int:
    """
    Rough estimation of token count from text.
    
    This is a simple heuristic: ~4 characters per token on average.
    For more accurate estimation, consider using tiktoken library.
    
    Args:
        text: Input text
        
    Returns:
        Estimated token count
    """
    # Simple heuristic: average of 4 characters per token
    return max(1, len(text) // 4)


def estimate_conversation_tokens(conversation: list) -> int:
    """
    Estimate total tokens in a conversation.
    
    Args:
        conversation: List of message dicts with "content" field
        
    Returns:
        Estimated total token count
    """
    total = 0
    for message in conversation:
        content = message.get("content", "")
        total += estimate_tokens(content)
    return total


# ============================================================================
# RESPONSE FORMATTING HELPERS
# ============================================================================

def format_cost_display(cost: float) -> str:
    """
    Format cost for display in the UI.
    
    Args:
        cost: Cost in dollars
        
    Returns:
        Formatted cost string
        
    Example:
        >>> format_cost_display(0.000123)
        "$0.000123"
        >>> format_cost_display(0.05)
        "$0.05"
    """
    if cost < 0.000001:
        return "$0.000000"
    elif cost < 0.01:
        return f"${cost:.6f}"
    else:
        return f"${cost:.4f}"


def format_timing_display(milliseconds: float) -> str:
    """
    Format timing for display in the UI.
    
    Args:
        milliseconds: Time in milliseconds
        
    Returns:
        Formatted timing string
        
    Example:
        >>> format_timing_display(1234.56)
        "1.23s"
        >>> format_timing_display(234.5)
        "235ms"
    """
    if milliseconds >= 1000:
        seconds = milliseconds / 1000
        return f"{seconds:.2f}s"
    else:
        return f"{int(milliseconds)}ms"


def create_error_event(
    error_message: str,
    error_type: str = "inference_error",
    model_info: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create an error event for the frontend.
    
    Args:
        error_message: Error message to display
        error_type: Type of error (e.g., "routing_error", "inference_error")
        model_info: Optional model information if available
        
    Returns:
        Dict containing error information
    """
    event = {
        "status": "error",
        "error_type": error_type,
        "error_message": error_message,
        "timestamp": time.time()
    }
    
    if model_info:
        event["model"] = model_info
    
    return event
