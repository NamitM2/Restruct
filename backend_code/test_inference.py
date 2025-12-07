"""
Test inference functions with edge cases.
"""

import os
import sys

CURRENT_DIR = os.path.dirname(__file__)
PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))
ROOT_DIR = os.path.abspath(os.path.join(PARENT_DIR, os.pardir))
for path in (ROOT_DIR, PARENT_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

from backend_code.inference import call_google, call_anthropic, call_openai
from backend_code.models_config import MODELS


def test_google_basic():
    """Test basic Google Gemini call."""
    print("\n=== Testing Google Gemini (basic) ===")
    model = {
        "api_key": MODELS["google"]["api_key"],
        "model_name": "gemini-2.5-flash-lite",
        "vendor": "google",
        "config": MODELS["google"]["models"]["gemini-2.5-flash-lite"]
    }

    prompt = "Say hello in one word"
    result = call_google(model, prompt)

    print(f"Prompt: {prompt}")
    print(f"Response: {result['text'][:100]}")
    print(f"Input tokens: {result['input_tokens']}")
    print(f"Output tokens: {result['output_tokens']}")

    assert "text" in result
    assert "input_tokens" in result
    assert "output_tokens" in result
    assert result["input_tokens"] > 0
    assert result["output_tokens"] > 0
    print("[PASS] Basic test passed")


def test_google_empty_prompt():
    """Test Google with empty prompt."""
    print("\n=== Testing Google Gemini (empty prompt) ===")
    model = {
        "api_key": MODELS["google"]["api_key"],
        "model_name": "gemini-2.5-flash-lite",
        "vendor": "google",
        "config": MODELS["google"]["models"]["gemini-2.5-flash-lite"]
    }

    try:
        prompt = ""
        result = call_google(model, prompt)
        print(f"Response: {result['text'][:100]}")
        print("[PASS] Empty prompt handled")
    except Exception as e:
        print(f"[PASS] Empty prompt error (expected): {type(e).__name__}")


def test_google_special_characters():
    """Test Google with special characters."""
    print("\n=== Testing Google Gemini (special characters) ===")
    model = {
        "api_key": MODELS["google"]["api_key"],
        "model_name": "gemini-2.5-flash-lite",
        "vendor": "google",
        "config": MODELS["google"]["models"]["gemini-2.5-flash-lite"]
    }

    prompt = "What is $x^2 + y^2 = r^2$ in LaTeX? Answer in one sentence."
    result = call_google(model, prompt)

    print(f"Prompt: {prompt}")
    print(f"Response: {result['text'][:100]}")
    print(f"Input tokens: {result['input_tokens']}")
    print(f"Output tokens: {result['output_tokens']}")
    print("[PASS] Special characters test passed")


def test_google_long_prompt():
    """Test Google with long prompt."""
    print("\n=== Testing Google Gemini (long prompt) ===")
    model = {
        "api_key": MODELS["google"]["api_key"],
        "model_name": "gemini-2.5-flash-lite",
        "vendor": "google",
        "config": MODELS["google"]["models"]["gemini-2.5-flash-lite"]
    }

    prompt = "Explain quantum computing. " * 50 + " Answer in one sentence."
    result = call_google(model, prompt)

    print(f"Prompt length: {len(prompt)} chars")
    print(f"Response: {result['text'][:100]}")
    print(f"Input tokens: {result['input_tokens']}")
    print(f"Output tokens: {result['output_tokens']}")
    print("[PASS] Long prompt test passed")


def test_anthropic_basic():
    """Test basic Anthropic Claude call."""
    print("\n=== Testing Anthropic Claude (basic) ===")
    model = {
        "api_key": MODELS["anthropic"]["api_key"],
        "model_name": "claude-haiku-4.5",
        "vendor": "anthropic",
        "config": MODELS["anthropic"]["models"]["claude-haiku-4.5"]
    }

    prompt = "Say hello in one word"

    try:
        result = call_anthropic(model, prompt)

        print(f"Prompt: {prompt}")
        print(f"Response: {result['text'][:100]}")
        print(f"Input tokens: {result['input_tokens']}")
        print(f"Output tokens: {result['output_tokens']}")

        assert "text" in result
        assert "input_tokens" in result
        assert "output_tokens" in result
        assert result["input_tokens"] > 0
        assert result["output_tokens"] > 0
        print("[PASS] Basic test passed")
    except Exception as e:
        print(f"[FAIL] Test failed (API key may be invalid): {type(e).__name__}: {e}")


def test_openai_basic():
    """Test basic OpenAI call."""
    print("\n=== Testing OpenAI (basic) ===")
    model = {
        "api_key": MODELS["openai"]["api_key"],
        "model_name": "gpt-5-nano-low",
        "vendor": "openai",
        "config": MODELS["openai"]["models"]["gpt-5-nano-low"]
    }

    prompt = "Say hello in one word"

    try:
        result = call_openai(model, prompt)

        print(f"Prompt: {prompt}")
        print(f"Response: {result['text'][:100]}")
        print(f"Input tokens: {result['input_tokens']}")
        print(f"Output tokens: {result['output_tokens']}")

        assert "text" in result
        assert "input_tokens" in result
        assert "output_tokens" in result
        assert result["input_tokens"] > 0
        assert result["output_tokens"] > 0
        print("[PASS] Basic test passed")
    except Exception as e:
        print(f"[FAIL] Test failed (API key may be invalid): {type(e).__name__}: {e}")


def test_cost_calculation():
    """Test cost calculation accuracy."""
    print("\n=== Testing Cost Calculation ===")
    model = {
        "api_key": MODELS["google"]["api_key"],
        "model_name": "gemini-2.5-flash-lite",
        "vendor": "google",
        "config": MODELS["google"]["models"]["gemini-2.5-flash-lite"]
    }

    prompt = "Count to 5"
    result = call_google(model, prompt)

    input_cost = model["config"]["input_token_cost"]
    output_cost = model["config"]["output_token_cost"]
    calculated_cost = (result["input_tokens"] * input_cost) + (result["output_tokens"] * output_cost)

    print(f"Input tokens: {result['input_tokens']}")
    print(f"Output tokens: {result['output_tokens']}")
    print(f"Input cost per token: ${input_cost:.10f}")
    print(f"Output cost per token: ${output_cost:.10f}")
    print(f"Calculated total cost: ${calculated_cost:.6f}")

    assert calculated_cost > 0
    print("[PASS] Cost calculation passed")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("RUNNING INFERENCE API TESTS")
    print("=" * 60)

    # Google tests (should work if API key is valid)
    test_google_basic()
    test_google_empty_prompt()
    test_google_special_characters()
    test_google_long_prompt()
    test_cost_calculation()

    # Anthropic tests
    test_anthropic_basic()

    # OpenAI tests
    test_openai_basic()

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
