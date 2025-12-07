"""
Test all models in the configuration to see which ones work.
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


def test_all_models():
    """Test every single model in the configuration."""
    test_prompt = "Say hello in one word"

    results = {
        "passed": [],
        "failed": []
    }

    print("=" * 80)
    print("TESTING ALL MODELS IN CONFIGURATION")
    print("=" * 80)

    # Test all OpenAI models
    print("\n" + "=" * 80)
    print("OPENAI MODELS")
    print("=" * 80)

    for model_name, model_config in MODELS["openai"]["models"].items():
        print(f"\n--- Testing: {model_name} ---")
        model = {
            "api_key": MODELS["openai"]["api_key"],
            "model_name": model_name,
            "vendor": "openai",
            "config": model_config
        }

        try:
            result = call_openai(model, test_prompt)
            print(f"[PASS] Response: {result['text'][:50]}")
            print(f"       Tokens: {result['input_tokens']} in, {result['output_tokens']} out")
            results["passed"].append(f"openai:{model_name}")
        except Exception as e:
            print(f"[FAIL] Error: {type(e).__name__}: {str(e)[:100]}")
            results["failed"].append({
                "model": f"openai:{model_name}",
                "error": f"{type(e).__name__}: {str(e)}"
            })

    # Test all Google models
    print("\n" + "=" * 80)
    print("GOOGLE GEMINI MODELS")
    print("=" * 80)

    for model_name, model_config in MODELS["google"]["models"].items():
        print(f"\n--- Testing: {model_name} ---")
        model = {
            "api_key": MODELS["google"]["api_key"],
            "model_name": model_name,
            "vendor": "google",
            "config": model_config
        }

        try:
            result = call_google(model, test_prompt)
            print(f"[PASS] Response: {result['text'][:50]}")
            print(f"       Tokens: {result['input_tokens']} in, {result['output_tokens']} out")
            results["passed"].append(f"google:{model_name}")
        except Exception as e:
            print(f"[FAIL] Error: {type(e).__name__}: {str(e)[:100]}")
            results["failed"].append({
                "model": f"google:{model_name}",
                "error": f"{type(e).__name__}: {str(e)}"
            })

    # Test all Anthropic models
    print("\n" + "=" * 80)
    print("ANTHROPIC CLAUDE MODELS")
    print("=" * 80)

    for model_name, model_config in MODELS["anthropic"]["models"].items():
        print(f"\n--- Testing: {model_name} ---")
        model = {
            "api_key": MODELS["anthropic"]["api_key"],
            "model_name": model_name,
            "vendor": "anthropic",
            "config": model_config
        }

        try:
            result = call_anthropic(model, test_prompt)
            print(f"[PASS] Response: {result['text'][:50]}")
            print(f"       Tokens: {result['input_tokens']} in, {result['output_tokens']} out")
            results["passed"].append(f"anthropic:{model_name}")
        except Exception as e:
            print(f"[FAIL] Error: {type(e).__name__}: {str(e)[:100]}")
            results["failed"].append({
                "model": f"anthropic:{model_name}",
                "error": f"{type(e).__name__}: {str(e)}"
            })

    # Print summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    print(f"\n[PASSED] {len(results['passed'])} models:")
    for model in results["passed"]:
        print(f"  - {model}")

    print(f"\n[FAILED] {len(results['failed'])} models:")
    for item in results["failed"]:
        print(f"  - {item['model']}")
        print(f"    Error: {item['error'][:150]}")

    print("\n" + "=" * 80)
    print(f"Total: {len(results['passed'])} passed, {len(results['failed'])} failed")
    print("=" * 80)

    return results


if __name__ == "__main__":
    test_all_models()
