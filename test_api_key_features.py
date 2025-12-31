"""
Test script for per-key rate limits and usage analytics.

Run this after:
1. Running migration_007_per_key_limits.sql in Supabase
2. Starting the FastAPI server: uvicorn backend_code.app:app --reload
"""

from openai import OpenAI
import requests
import time
import json

# Configuration
BASE_URL = "http://localhost:8000/v1"
JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6ImxPTU11eUQzNkozOFdPOHgiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NwYXpnaGt2YWJnY2phbnVyZHloLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJmYjEyOTBhZC1kZGI2LTRmNjUtYTc3ZS1lMmEzY2E4MjQ5YjciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY3MjUyODI4LCJpYXQiOjE3NjY2NDgwMjgsImVtYWlsIjoibmFtaXRtMkBpbGxpbm9pcy5lZHUiLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsIjoibmFtaXRtMkBpbGxpbm9pcy5lZHUiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGhvbmVfdmVyaWZpZWQiOmZhbHNlLCJzdWIiOiJmYjEyOTBhZC1kZGI2LTRmNjUtYTc3ZS1lMmEzY2E4MjQ5YjcifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2NjYzMDAyM31dLCJzZXNzaW9uX2lkIjoiOTA5ZTU4ZDItM2Y4Yy00OWQ0LTg3NDEtMDM2ODQ5M2I3MjM4IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.cO5OQqRwzoUCakiaQXkgP-XP8oJq6p3fRh40dsRKMe8"  # Get from browser localStorage


def test_create_key_with_limits():
    """Test creating API key with rate limits and metadata."""
    print("\n" + "=" * 60)
    print("TEST 1: Create API key with rate limits and metadata")
    print("=" * 60)

    response = requests.post(
        f"{BASE_URL}/keys",
        headers={"Authorization": f"Bearer {JWT_TOKEN}"},
        json={
            "name": "Test Low-Cost Key",
            "rate_limit_rpm": 3,      # Very low to hit limit quickly
            "rate_limit_rph": 5,      # Total of 5 requests per hour
            "rate_limit_rpd": 10,     # Max 10 requests per day
            "environment": "testing",
            "application": "test-suite",
            "tags": ["low-cost", "testing"],
            "notes": "Testing per-key rate limits with minimal cost"
        }
    )

    if response.status_code == 200:
        data = response.json()
        print("✓ Key created successfully!")
        print(f"  Key: {data['key'][:20]}...")
        print(f"  Key ID: {data['id']}")
        print(f"  Rate Limits: {data.get('rate_limits')}")
        print(f"  Metadata: {data.get('metadata')}")
        return data['key'], data['id']
    else:
        print(f"✗ Failed: {response.status_code}")
        print(response.text)
        return None, None


def test_rate_limiting(api_key):
    """Test per-key rate limiting by making rapid requests."""
    print("\n" + "=" * 60)
    print("TEST 2: Test per-key rate limiting (3 RPM)")
    print("=" * 60)

    client = OpenAI(base_url=BASE_URL, api_key=api_key)

    print("Making 5 requests rapidly (should hit 3 RPM limit)...")
    print("Using very short prompts to minimize cost (~$0.0001 per request)")

    for i in range(5):
        try:
            response = client.chat.completions.create(
                model="google:gemini-2.0-flash-lite",  # Cheapest model
                messages=[{"role": "user", "content": "Hi"}]  # Minimal prompt
            )
            print(f"  ✓ Request {i+1}: Success (Cost: ~$0.0001)")
        except Exception as e:
            if "429" in str(e):
                print(f"  ✗ Request {i+1}: Rate limited! (Expected after 3 requests)")
                print(f"     Error: {str(e)[:100]}...")
            else:
                print(f"  ✗ Request {i+1}: Error - {str(e)[:100]}...")

        time.sleep(0.3)  # Small delay between requests


def test_key_usage_analytics(key_id):
    """Test getting usage analytics for a specific key."""
    print("\n" + "=" * 60)
    print("TEST 3: Get key usage analytics")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/keys/{key_id}/usage?time_range=24h",
        headers={"Authorization": f"Bearer {JWT_TOKEN}"}
    )

    if response.status_code == 200:
        data = response.json()["data"]
        print("✓ Usage stats retrieved!")
        print(f"  Total Requests: {data['summary']['total_requests']}")
        print(f"  Total Cost: ${data['summary']['total_cost']}")
        print(f"  Total Tokens: {data['summary']['total_tokens']}")
        print(f"  Success Rate: {data['summary']['success_rate']}%")
        print(f"  Avg Latency: {data['summary']['avg_latency_ms']}ms")

        if data.get('top_models'):
            print("\n  Top Models:")
            for model in data['top_models'][:3]:
                print(f"    - {model['provider']}:{model['model']} (${model['cost']:.4f}, {model['requests']} reqs)")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(response.text)


def test_key_timeline(key_id):
    """Test getting daily timeline for a key."""
    print("\n" + "=" * 60)
    print("TEST 4: Get key usage timeline")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/keys/{key_id}/timeline?days=7",
        headers={"Authorization": f"Bearer {JWT_TOKEN}"}
    )

    if response.status_code == 200:
        data = response.json()["data"]
        print("✓ Timeline retrieved!")
        print(f"  Days with data: {len(data)}")

        if data:
            print("\n  Recent activity:")
            for day in data[-3:]:  # Last 3 days
                print(f"    {day['date']}: {day['requests']} reqs, ${day['cost']:.4f}, {day['tokens']} tokens")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(response.text)


def test_compare_keys():
    """Test comparing usage across all keys."""
    print("\n" + "=" * 60)
    print("TEST 5: Compare all keys")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/keys/compare?time_range=7d",
        headers={"Authorization": f"Bearer {JWT_TOKEN}"}
    )

    if response.status_code == 200:
        data = response.json()["data"]
        print("✓ Comparison retrieved!")
        print(f"  Total keys: {len(data)}")

        if data:
            print("\n  Keys ranked by cost:")
            for key in data[:5]:  # Top 5
                print(f"    {key['name'] or key['key_prefix']}: ${key['cost']:.4f}, {key['requests']} reqs, {key['success_rate']:.1f}% success")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(response.text)


def test_rate_limit_status(key_id):
    """Test getting current rate limit status."""
    print("\n" + "=" * 60)
    print("TEST 6: Get rate limit status")
    print("=" * 60)

    response = requests.get(
        f"{BASE_URL}/keys/{key_id}/rate-limits",
        headers={"Authorization": f"Bearer {JWT_TOKEN}"}
    )

    if response.status_code == 200:
        data = response.json()["data"]
        print("✓ Rate limit status retrieved!")

        for window, stats in data.items():
            print(f"\n  {window.capitalize()}:")
            print(f"    Current: {stats['current']}/{stats['limit']}")
            print(f"    Remaining: {stats['remaining']}")
            print(f"    Resets at: {stats['reset_at']}")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(response.text)


def test_update_key_metadata(key_id):
    """Test updating key metadata and limits."""
    print("\n" + "=" * 60)
    print("TEST 7: Update key metadata")
    print("=" * 60)

    response = requests.patch(
        f"{BASE_URL}/keys/{key_id}",
        headers={"Authorization": f"Bearer {JWT_TOKEN}"},
        json={
            "name": "Updated Test Key",
            "rate_limit_rpm": 5,  # Increase slightly
            "tags": ["testing", "updated"],
            "notes": "Updated rate limit after initial testing"
        }
    )

    if response.status_code == 200:
        print("✓ Key updated successfully!")
        print(f"  Updated fields: {response.json()['fields']}")
    else:
        print(f"✗ Failed: {response.status_code}")
        print(response.text)


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("RESTRUCT API KEY FEATURES TEST SUITE (LOW-COST)")
    print("=" * 60)
    print("\nMake sure to:")
    print("1. Run migration_007_per_key_limits.sql in Supabase")
    print("2. Start FastAPI server: uvicorn backend_code.app:app --reload")
    print("3. Set JWT_TOKEN in this script (from browser localStorage)")
    print("\n⚠️  COST ESTIMATE: ~$0.005 - $0.01 per full test run")
    print("   - Uses cheapest model (gemini-2.0-flash-lite)")
    print("   - Minimal prompts (2-3 tokens each)")
    print("   - Only 5 actual inference requests")
    print("=" * 60)

    if JWT_TOKEN == "YOUR_JWT_TOKEN_HERE":
        print("\n⚠ ERROR: Please set JWT_TOKEN in the script first!")
        print("Get it from browser localStorage: sb-<project>-auth-token -> access_token")
        exit(1)

    # Run tests
    api_key, key_id = test_create_key_with_limits()

    if api_key and key_id:
        test_rate_limiting(api_key)
        test_key_usage_analytics(key_id)
        test_key_timeline(key_id)
        test_rate_limit_status(key_id)
        test_update_key_metadata(key_id)
        test_compare_keys()

        print("\n" + "=" * 60)
        print("ALL TESTS COMPLETED!")
        print("=" * 60)
        print(f"\n📊 COST SUMMARY:")
        print(f"   Successful requests: 3-5 (depending on rate limit)")
        print(f"   Model used: gemini-2.0-flash-lite ($0.05/$0.10 per 1M tokens)")
        print(f"   Avg tokens per request: ~10 (input + output)")
        print(f"   Estimated total cost: $0.003 - $0.008")
        print(f"\n🔑 Your test API key: {api_key[:20]}...")
        print("   Save this key if you want to use it later.")
        print("\n💡 TIP: Check actual costs in the usage analytics:")
        print(f"   GET {BASE_URL}/keys/{key_id}/usage?time_range=24h")
    else:
        print("\n✗ Failed to create API key. Cannot continue tests.")
