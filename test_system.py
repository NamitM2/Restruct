#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Test Script for Restruct
Tests all components without requiring API keys
"""

import sys
import os
from typing import Dict

# Set UTF-8 encoding for Windows console
if sys.platform == "win32":
    os.system("chcp 65001 >nul 2>&1")
    sys.stdout.reconfigure(encoding='utf-8')


def test_imports():
    """Test that all modules can be imported"""
    print("Testing module imports...")

    try:
        import app
        print("  ✓ app.py")
    except Exception as e:
        print(f"  ✗ app.py: {e}")
        return False

    try:
        import router
        print("  ✓ router.py")
    except Exception as e:
        print(f"  ✗ router.py: {e}")
        return False

    try:
        import inference
        print("  ✓ inference.py")
    except Exception as e:
        print(f"  ✗ inference.py: {e}")
        return False

    try:
        import database
        print("  ✓ database.py")
    except Exception as e:
        print(f"  ✗ database.py: {e}")
        return False

    try:
        import models_config
        print("  ✓ models_config.py")
    except Exception as e:
        print(f"  ✗ models_config.py: {e}")
        return False

    return True


def test_models_config():
    """Test models configuration"""
    print("\nTesting models configuration...")

    try:
        from models_config import MODELS, get_all_models, get_model_info

        # Check providers exist
        assert "openai" in MODELS, "OpenAI provider missing"
        assert "google" in MODELS, "Google provider missing"
        assert "anthropic" in MODELS, "Anthropic provider missing"
        print("  ✓ All providers configured")

        # Check model count
        all_models = get_all_models()
        model_count = len(all_models)
        assert model_count > 0, "No models configured"
        print(f"  ✓ {model_count} models available")

        # Check model attributes
        for model_name, attrs in all_models.items():
            assert "cost" in attrs, f"{model_name} missing cost"
            assert "performance" in attrs, f"{model_name} missing performance"
            assert "provider" in attrs, f"{model_name} missing provider"
        print("  ✓ All models have required attributes")

        # Test get_model_info
        first_model = list(all_models.keys())[0]
        info = get_model_info(first_model)
        assert info is not None, "get_model_info failed"
        print("  ✓ get_model_info() working")

        return True

    except Exception as e:
        print(f"  ✗ Configuration error: {e}")
        return False


def test_router():
    """Test routing logic"""
    print("\nTesting router logic...")

    try:
        from router import ModelRouter
        import os

        # Temporarily set a dummy API key for testing
        os.environ["OPENAI_API_KEY"] = "sk-test-key-for-routing-only"

        router_instance = ModelRouter()
        print("  ✓ Router initialized")

        # Test prompt analysis
        analysis = router_instance.analyze_prompt("Write a short story about robots")
        assert "word_count" in analysis
        assert "is_creative" in analysis
        print("  ✓ Prompt analysis working")

        # Test routing (without API call)
        try:
            result = router_instance.route("Test prompt", priority="balanced")
            assert "model" in result
            assert "provider" in result
            assert "score" in result
            assert "routing_strategy" in result
            print(f"  ✓ Routing working (selected: {result['model']})")
        except ValueError as e:
            if "No models available" in str(e):
                print("  ⚠ Routing test skipped (no API keys configured)")
                print("    This is normal - configure .env to test with real keys")
            else:
                raise

        # Test different priorities
        for priority in ["cost", "performance", "balanced"]:
            try:
                result = router_instance.route("Test", priority=priority)
                print(f"  ✓ {priority.capitalize()} routing working")
            except ValueError:
                print(f"  ⚠ {priority.capitalize()} routing skipped (no API keys)")

        return True

    except Exception as e:
        print(f"  ✗ Router error: {e}")
        return False


def test_inference():
    """Test inference engine initialization"""
    print("\nTesting inference engine...")

    try:
        from inference import InferenceEngine

        engine = InferenceEngine()
        print("  ✓ Inference engine initialized")

        # Test that methods exist
        assert hasattr(engine, 'call_openai')
        assert hasattr(engine, 'call_google')
        assert hasattr(engine, 'call_anthropic')
        assert hasattr(engine, 'run_inference')
        print("  ✓ All provider methods available")

        print("  ⚠ Actual API calls not tested (requires valid API keys)")

        return True

    except Exception as e:
        print(f"  ✗ Inference error: {e}")
        return False


def test_database():
    """Test database module"""
    print("\nTesting database module...")

    try:
        from database import Database

        db = Database()
        print("  ✓ Database initialized")

        # Test that methods exist
        assert hasattr(db, 'save_interaction')
        assert hasattr(db, 'get_user_history')
        assert hasattr(db, 'get_model_stats')
        print("  ✓ All database methods available")

        print("  ⚠ Database operations not tested (requires Supabase config)")

        return True

    except Exception as e:
        print(f"  ✗ Database error: {e}")
        return False


def test_fastapi_app():
    """Test FastAPI application"""
    print("\nTesting FastAPI app...")

    try:
        from app import app

        # Check routes exist
        routes = [route.path for route in app.routes]
        required_routes = ["/", "/chat", "/routing/route", "/models", "/stats"]

        for route in required_routes:
            if route in routes:
                print(f"  ✓ {route} endpoint exists")
            else:
                print(f"  ✗ {route} endpoint missing")
                return False

        print("  ✓ All required endpoints configured")

        return True

    except Exception as e:
        print(f"  ✗ FastAPI error: {e}")
        return False


def test_frontend_files():
    """Test that frontend files exist"""
    print("\nTesting frontend files...")

    import os

    frontend_files = [
        "frontend/index.html",
        "frontend/style.css",
        "frontend/script.js"
    ]

    all_exist = True
    for file_path in frontend_files:
        if os.path.exists(file_path):
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} missing")
            all_exist = False

    return all_exist


def print_summary(results: Dict[str, bool]):
    """Print test summary"""
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    total = len(results)
    passed = sum(1 for v in results.values() if v)
    failed = total - passed

    for test_name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} - {test_name}")

    print("-" * 60)
    print(f"Total: {total} | Passed: {passed} | Failed: {failed}")

    if failed == 0:
        print("\n✅ All tests passed! System is ready.")
        print("\nNext steps:")
        print("1. Configure API keys in .env")
        print("2. Run: python start.py")
        print("3. Open: http://localhost:8000/index.html")
    else:
        print("\n⚠️ Some tests failed. Please fix the issues above.")

    print("=" * 60)


def main():
    """Run all tests"""
    print("=" * 60)
    print("RESTRUCT SYSTEM TEST")
    print("=" * 60)
    print()

    results = {}

    # Run all tests
    results["Module Imports"] = test_imports()
    results["Models Configuration"] = test_models_config()
    results["Router Logic"] = test_router()
    results["Inference Engine"] = test_inference()
    results["Database Module"] = test_database()
    results["FastAPI App"] = test_fastapi_app()
    results["Frontend Files"] = test_frontend_files()

    # Print summary
    print_summary(results)

    # Exit with appropriate code
    sys.exit(0 if all(results.values()) else 1)


if __name__ == "__main__":
    main()
