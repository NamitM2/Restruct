"""
API Call Metadata - Quick Reference

Import these functions in app.py for routing status and cost tracking.
"""

from backend_code.api_call_metadata import (
    # ============================================================
    # ROUTING STATUS - Send events to frontend
    # ============================================================
    create_routing_complete_event,      # After routing completes
    create_inference_start_event,       # Before inference starts
    create_inference_complete_event,    # After inference completes
    create_error_event,                 # On error
    
    # ============================================================
    # COST CALCULATION - Calculate API costs
    # ============================================================
    calculate_api_cost,                 # Calculate cost from tokens
    estimate_cost_for_model,            # Estimate cost before API call
    
    # ============================================================
    # MODEL INFORMATION - Get display info
    # ============================================================
    get_model_display_info,             # Get model display name, logo, etc.
    extract_model_capabilities,         # Get capability attributes
    get_model_max_tokens,               # Get model token limit
    
    # ============================================================
    # UTILITIES - Format and estimate
    # ============================================================
    format_cost_display,                # Format cost for UI
    format_timing_display,              # Format timing for UI
    estimate_tokens,                    # Estimate tokens from text
    estimate_conversation_tokens,       # Estimate conversation tokens
)


# ============================================================
# USAGE EXAMPLES
# ============================================================

def example_chat_endpoint():
    """
    Example showing how to use these functions in a chat endpoint.
    """
    import time
    
    # ... setup code ...
    
    # 1. ROUTING PHASE
    routing_start = time.time()
    model_choice = resolve_model_choice(router_mode, model_override, conversation)
    routing_time = time.time() - routing_start
    
    # Create routing complete event
    routing_event = create_routing_complete_event(
        model_choice=model_choice,
        routing_time_seconds=routing_time,
        routing_model="gemini"
    )
    # TODO: Send routing_event to frontend (via SSE/websocket)
    # This allows frontend to show: Model Logo + "Thinking..."
    
    # 2. INFERENCE PHASE
    inference_start = time.time()
    response_data = inference(model_choice, conversation)
    inference_time = time.time() - inference_start
    
    # 3. CREATE COMPLETE RESPONSE
    response_event = create_inference_complete_event(
        response_text=response_data["text"],
        model_choice=model_choice,
        response_data=response_data,
        routing_time_seconds=routing_time,
        inference_time_seconds=inference_time,
        routing_model="gemini"
    )
    
    return response_event


def example_cost_calculation():
    """
    Example showing how to calculate costs.
    """
    # After inference
    response_data = inference(model_choice, conversation)
    
    # Calculate detailed cost breakdown
    cost_breakdown = calculate_api_cost(
        input_tokens=response_data["input_tokens"],
        output_tokens=response_data["output_tokens"],
        model_config=model_choice["config"]
    )
    
    # Access cost information
    total_cost = cost_breakdown.total_cost
    formatted_cost = cost_breakdown.to_dict()["total_cost_formatted"]
    
    print(f"Total cost: {formatted_cost}")


def example_model_info():
    """
    Example showing how to get model display information.
    """
    # Get display info for frontend
    model_info = get_model_display_info(
        provider="openai",
        model_name="gpt-5"
    )
    
    print(f"Display name: {model_info['display_name']}")  # "GPT-5"
    print(f"Logo URL: {model_info['logo_url']}")          # "/assets/logos/openai.svg"
    print(f"Full name: {model_info['full_name']}")        # "OpenAI GPT-5"


# ============================================================
# FRONTEND EVENT STRUCTURE
# ============================================================

"""
Routing Complete Event (sent after routing):
{
  "status": "routing_complete",
  "routing_time_ms": 234.56,
  "selected_model": {
    "provider": "openai",
    "model_name": "gpt-5"
  }
}

Inference Complete Event (sent after inference):
{
  "status": "complete",
  "output": "Response text...",
  "model": "gpt-5",
  "provider": "openai",
  "usage": {
    "input_tokens": 1000,
    "output_tokens": 500,
    "cost": 0.006250,
    "cost_breakdown": {
      "total_cost_formatted": "$0.006250"
    }
  },
  "timing": {
    "routing_time_ms": 234.56,
    "inference_time_ms": 1234.56,
    "total_time_ms": 1469.12
  }
}
"""
