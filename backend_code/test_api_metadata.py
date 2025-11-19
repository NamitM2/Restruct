"""
Test script for api_call_metadata module.

Run this to verify all helper functions work correctly.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend_code.api_call_metadata import (
    calculate_api_cost,
    estimate_cost_for_model,
    create_routing_complete_event,
    create_inference_complete_event,
    get_model_display_info,
    format_cost_display,
    format_timing_display,
    estimate_tokens,
    estimate_conversation_tokens,
    create_error_event
)
import json


def test_cost_calculation():
    """Test cost calculation functions."""
    print("=" * 60)
    print("TEST: Cost Calculation")
    print("=" * 60)
    
    # Mock model config
    model_config = {
        "input_token_cost": 1.25 / 1_000_000,  # $1.25 per 1M tokens
        "output_token_cost": 10.0 / 1_000_000,  # $10.00 per 1M tokens
    }
    
    # Calculate cost for 1000 input, 500 output tokens
    cost = calculate_api_cost(
        input_tokens=1000,
        output_tokens=500,
        model_config=model_config
    )
    
    print(f"Input tokens: {cost.input_tokens}")
    print(f"Output tokens: {cost.output_tokens}")
    print(f"Input cost: ${cost.input_cost_total:.6f}")
    print(f"Output cost: ${cost.output_cost_total:.6f}")
    print(f"Total cost: ${cost.total_cost:.6f}")
    print(f"Formatted: {cost.to_dict()['total_cost_formatted']}")
    print()


def test_cost_estimation():
    """Test cost estimation for different models."""
    print("=" * 60)
    print("TEST: Cost Estimation")
    print("=" * 60)
    
    models_to_test = [
        ("openai", "gpt-5"),
        ("google", "gemini-2.5-pro"),
        ("anthropic", "claude-opus-4-1")
    ]
    
    for provider, model_name in models_to_test:
        cost_estimate = estimate_cost_for_model(
            estimated_input_tokens=1000,
            estimated_output_tokens=500,
            provider=provider,
            model_name=model_name
        )
        
        if cost_estimate:
            print(f"{provider}:{model_name}")
            print(f"  Estimated cost: ${cost_estimate.total_cost:.6f}")
        else:
            print(f"{provider}:{model_name} - NOT FOUND")
    print()


def test_routing_complete_event():
    """Test routing complete event creation."""
    print("=" * 60)
    print("TEST: Routing Complete Event")
    print("=" * 60)
    
    # Mock model choice
    model_choice = {
        "vendor": "openai",
        "model_name": "gpt-5",
        "score": 9.5,
        "config": {},
        "llm_scores": {
            "overall_complexity": 9.5,
            "mathematical_and_logical_reasoning": 9.0
        }
    }
    
    event = create_routing_complete_event(
        model_choice=model_choice,
        routing_time_seconds=0.234,
        routing_model="gemini"
    )
    
    print(json.dumps(event, indent=2))
    print()


def test_inference_complete_event():
    """Test inference complete event creation."""
    print("=" * 60)
    print("TEST: Inference Complete Event")
    print("=" * 60)
    
    # Mock model choice
    model_choice = {
        "vendor": "openai",
        "model_name": "gpt-5",
        "score": 9.5,
        "config": {
            "input_token_cost": 1.25 / 1_000_000,
            "output_token_cost": 10.0 / 1_000_000
        },
        "llm_scores": {
            "overall_complexity": 9.5
        }
    }
    
    # Mock response data
    response_data = {
        "text": "This is a test response from the LLM.",
        "input_tokens": 1000,
        "output_tokens": 500
    }
    
    event = create_inference_complete_event(
        response_text=response_data["text"],
        model_choice=model_choice,
        response_data=response_data,
        routing_time_seconds=0.234,
        inference_time_seconds=1.456,
        routing_model="gemini"
    )
    
    print(json.dumps(event, indent=2))
    print()


def test_model_display_info():
    """Test model display information extraction."""
    print("=" * 60)
    print("TEST: Model Display Information")
    print("=" * 60)
    
    providers = [
        ("openai", "gpt-5"),
        ("google", "gemini-2.5-pro"),
        ("anthropic", "claude-opus-4-1")
    ]
    
    for provider, model_name in providers:
        info = get_model_display_info(provider, model_name)
        print(f"{info['full_name']}")
        print(f"  Display: {info['display_name']}")
        print(f"  Logo: {info['logo_url']}")
    print()


def test_formatting():
    """Test formatting functions."""
    print("=" * 60)
    print("TEST: Formatting Functions")
    print("=" * 60)
    
    costs = [0.000000123, 0.000123, 0.0123, 1.23]
    print("Cost formatting:")
    for cost in costs:
        print(f"  ${cost} → {format_cost_display(cost)}")
    
    print("\nTiming formatting:")
    timings = [12.3, 123.4, 1234.5, 12345.6]
    for ms in timings:
        print(f"  {ms}ms → {format_timing_display(ms)}")
    print()


def test_token_estimation():
    """Test token estimation functions."""
    print("=" * 60)
    print("TEST: Token Estimation")
    print("=" * 60)
    
    text = "This is a sample text for token estimation. It should be roughly 20-25 tokens."
    estimated = estimate_tokens(text)
    print(f"Text: {text}")
    print(f"Estimated tokens: {estimated}")
    
    conversation = [
        {"role": "user", "content": "Hello, how are you?"},
        {"role": "assistant", "content": "I'm doing well, thank you! How can I help you today?"},
        {"role": "user", "content": "Can you explain quantum computing?"}
    ]
    
    total_tokens = estimate_conversation_tokens(conversation)
    print(f"\nConversation messages: {len(conversation)}")
    print(f"Estimated total tokens: {total_tokens}")
    print()


def test_error_event():
    """Test error event creation."""
    print("=" * 60)
    print("TEST: Error Event")
    print("=" * 60)
    
    error_event = create_error_event(
        error_message="API rate limit exceeded",
        error_type="rate_limit_error",
        model_info={"provider": "openai", "model_name": "gpt-5"}
    )
    
    print(json.dumps(error_event, indent=2))
    print()


def main():
    """Run all tests."""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "API CALL METADATA - TEST SUITE" + " " * 17 + "║")
    print("╚" + "=" * 58 + "╝")
    print("\n")
    
    test_cost_calculation()
    test_cost_estimation()
    test_routing_complete_event()
    test_inference_complete_event()
    test_model_display_info()
    test_formatting()
    test_token_estimation()
    test_error_event()
    
    print("=" * 60)
    print("✓ All tests completed successfully!")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()
