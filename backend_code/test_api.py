"""
Test OpenAI-compatible API endpoints.
"""

import os
import sys

CURRENT_DIR = os.path.dirname(__file__)
PARENT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))
for path in (PARENT_DIR, CURRENT_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

import httpx
import asyncio


# Test JWT token (this should be a valid token from your Supabase instance)
# For testing, you'll need to replace this with a real JWT token
TEST_JWT_TOKEN = os.environ.get("TEST_JWT_TOKEN", "")

# Import app
from backend_code.app import app


def get_client():
    """Create and return an async test client."""
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def test_models_endpoint():
    """Test /v1/models endpoint returns list of models."""
    print("\n=== Testing /v1/models ===")

    client = get_client()
    response = await client.get("/v1/models")

    print(f"Status: {response.status_code}")
    assert response.status_code == 200

    data = response.json()
    print(f"Response keys: {data.keys()}")

    assert "object" in data
    assert data["object"] == "list"
    assert "data" in data
    assert isinstance(data["data"], list)
    assert len(data["data"]) > 0

    # Check first model has expected structure
    first_model = data["data"][0]
    assert "id" in first_model
    assert "object" in first_model
    assert first_model["object"] == "model"
    assert "owned_by" in first_model

    print(f"Found {len(data['data'])} models")
    print(f"Sample model: {first_model['id']}")
    print("[PASS] Models endpoint test passed")


async def test_chat_completions_no_auth():
    """Test /v1/chat/completions without authentication."""
    print("\n=== Testing /v1/chat/completions (no auth) ===")

    client = get_client()
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Hello"}]
        }
    )

    print(f"Status: {response.status_code}")
    assert response.status_code == 401

    data = response.json()
    print(f"Error: {data.get('detail')}")
    assert "detail" in data
    print("[PASS] No auth test passed")


async def test_chat_completions_with_auth():
    """Test /v1/chat/completions with authentication."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING /v1/chat/completions (no JWT token) ===")
        print("Set TEST_JWT_TOKEN environment variable to test authenticated endpoints")
        return

    print("\n=== Testing /v1/chat/completions (with auth) ===")

    client = get_client()
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Say hello in one word"}]
        },
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.json()}")
        print("[FAIL] Authentication or routing failed")
        return

    data = response.json()
    print(f"Response keys: {data.keys()}")

    # Check OpenAI-compatible response structure
    assert "id" in data
    assert "object" in data
    assert data["object"] == "chat.completion"
    assert "created" in data
    assert "model" in data
    assert "choices" in data
    assert "usage" in data
    assert "restruct" in data

    # Check choices array
    assert len(data["choices"]) == 1
    choice = data["choices"][0]
    assert "index" in choice
    assert choice["index"] == 0
    assert "message" in choice
    assert "finish_reason" in choice

    # Check message
    message = choice["message"]
    assert "role" in message
    assert message["role"] == "assistant"
    assert "content" in message
    assert len(message["content"]) > 0

    # Check usage
    usage = data["usage"]
    assert "prompt_tokens" in usage
    assert "completion_tokens" in usage
    assert "total_tokens" in usage
    assert usage["total_tokens"] == usage["prompt_tokens"] + usage["completion_tokens"]

    # Check restruct metadata
    restruct = data["restruct"]
    assert "provider" in restruct
    assert restruct["provider"] in ["openai", "anthropic", "google"]

    print(f"Model used: {data['model']}")
    print(f"Provider: {restruct['provider']}")
    print(f"Response: {message['content'][:50]}...")
    print(f"Tokens: {usage['prompt_tokens']} in, {usage['completion_tokens']} out")
    print("[PASS] Authenticated chat completion test passed")


async def test_chat_completions_with_profile():
    """Test /v1/chat/completions with profile-based routing."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING profile routing test (no JWT token) ===")
        return

    print("\n=== Testing /v1/chat/completions (with profile) ===")

    client = get_client()
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Say hello"}],
            "restruct": {"profile": "cost-optimized"}
        },
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.json()}")
        print("[INFO] Profile may not exist or have no enabled providers")
        return

    data = response.json()
    restruct = data["restruct"]

    assert "profile_used" in restruct
    assert restruct["profile_used"] == "cost-optimized"

    print(f"Profile used: {restruct['profile_used']}")
    print(f"Model: {data['model']}")
    print(f"Provider: {restruct['provider']}")
    print("[PASS] Profile-based routing test passed")


async def test_chat_completions_manual_model():
    """Test /v1/chat/completions with manual model selection."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING manual model test (no JWT token) ===")
        return

    print("\n=== Testing /v1/chat/completions (manual model) ===")

    client = get_client()
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "google:gemini-2.5-flash-lite",
            "messages": [{"role": "user", "content": "Say hi"}]
        },
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.json()}")
        print("[FAIL] Manual model selection failed")
        return

    data = response.json()
    restruct = data["restruct"]

    assert restruct["provider"] == "google"
    assert data["model"] == "gemini-2.5-flash-lite"

    print(f"Model: {data['model']}")
    print(f"Provider: {restruct['provider']}")
    print("[PASS] Manual model selection test passed")


async def test_chat_completions_empty_messages():
    """Test /v1/chat/completions with empty messages array."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING empty messages test (no JWT token) ===")
        return

    print("\n=== Testing /v1/chat/completions (empty messages) ===")

    client = get_client()
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": []
        },
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {response.status_code}")
    assert response.status_code == 400

    data = response.json()
    print(f"Error: {data.get('detail')}")
    assert "detail" in data
    print("[PASS] Empty messages validation test passed")


async def test_chat_completions_streaming():
    """Test /v1/chat/completions with streaming (should fail in MVP)."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING streaming test (no JWT token) ===")
        return

    print("\n=== Testing /v1/chat/completions (streaming) ===")

    client = get_client()
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": True
        },
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {response.status_code}")
    assert response.status_code == 400

    data = response.json()
    print(f"Error: {data.get('detail')}")
    assert "stream" in data.get("detail", "").lower()
    print("[PASS] Streaming not supported test passed")


async def test_create_api_key():
    """Test creating a new API key."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING API key creation test (no JWT token) ===")
        return

    print("\n=== Testing POST /v1/keys ===")

    client = get_client()
    response = await client.post(
        "/v1/keys",
        params={"name": "Test Key"},
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.json()}")
        print("[FAIL] API key creation failed")
        return None

    data = response.json()

    assert "key" in data
    assert "key_prefix" in data
    assert "id" in data
    assert data["key"].startswith("rst_")
    assert len(data["key"]) > 20

    print(f"Created key: {data['key_prefix']}...")
    print(f"Full key length: {len(data['key'])} chars")
    print("[PASS] API key creation test passed")

    return data["key"]


async def test_use_api_key(api_key: str):
    """Test using an API key to authenticate."""
    if not api_key:
        print("\n=== SKIPPING API key usage test (no key) ===")
        return

    print("\n=== Testing chat completions with API key ===")

    client = get_client()
    response = await client.post(
        "/v1/chat/completions",
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Say hi"}]
        },
        headers={"Authorization": f"Bearer {api_key}"}
    )

    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.json()}")
        print("[FAIL] API key authentication failed")
        return

    data = response.json()

    assert "choices" in data
    assert len(data["choices"]) > 0
    assert "message" in data["choices"][0]

    print(f"Response: {data['choices'][0]['message']['content'][:30]}...")
    print("[PASS] API key authentication test passed")


async def test_list_api_keys():
    """Test listing API keys."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING API key list test (no JWT token) ===")
        return

    print("\n=== Testing GET /v1/keys ===")

    client = get_client()
    response = await client.get(
        "/v1/keys",
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {response.status_code}")

    if response.status_code != 200:
        print(f"Error: {response.json()}")
        print("[FAIL] List API keys failed")
        return

    data = response.json()

    assert "object" in data
    assert data["object"] == "list"
    assert "data" in data

    print(f"Found {len(data['data'])} API keys")
    if len(data["data"]) > 0:
        print(f"Sample key: {data['data'][0]['key_prefix']}...")

    print("[PASS] List API keys test passed")


async def test_delete_api_key():
    """Test deleting an API key."""
    if not TEST_JWT_TOKEN:
        print("\n=== SKIPPING API key deletion test (no JWT token) ===")
        return

    print("\n=== Testing DELETE /v1/keys/{key_id} ===")

    client = get_client()

    # First, create a key to delete
    create_response = await client.post(
        "/v1/keys",
        params={"name": "Key to Delete"},
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    if create_response.status_code != 200:
        print("[SKIP] Could not create key to delete")
        return

    key_id = create_response.json()["id"]

    # Now delete it
    delete_response = await client.delete(
        f"/v1/keys/{key_id}",
        headers={"Authorization": f"Bearer {TEST_JWT_TOKEN}"}
    )

    print(f"Status: {delete_response.status_code}")

    if delete_response.status_code != 200:
        print(f"Error: {delete_response.json()}")
        print("[FAIL] Delete API key failed")
        return

    data = delete_response.json()

    assert "deleted" in data
    assert data["deleted"] is True
    assert data["id"] == key_id

    print(f"Deleted key: {key_id}")
    print("[PASS] Delete API key test passed")


async def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("RUNNING API TESTS")
    print("=" * 60)

    if not TEST_JWT_TOKEN:
        print("\n[WARNING] TEST_JWT_TOKEN not set")
        print("Only unauthenticated tests will run")
        print("To test authenticated endpoints, set TEST_JWT_TOKEN environment variable\n")

    # Unauthenticated tests (always run)
    await test_models_endpoint()
    await test_chat_completions_no_auth()

    # Authenticated tests (require JWT token)
    await test_chat_completions_with_auth()
    await test_chat_completions_with_profile()
    await test_chat_completions_manual_model()
    await test_chat_completions_empty_messages()
    await test_chat_completions_streaming()

    # API key tests
    api_key = await test_create_api_key()
    await test_use_api_key(api_key)
    await test_list_api_keys()
    await test_delete_api_key()

    print("\n" + "=" * 60)
    print("ALL TESTS COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_all_tests())
