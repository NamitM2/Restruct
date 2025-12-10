# Restruct API

OpenAI-compatible API for programmatic access to intelligent routing.

## Setup

### 1. Run Database Migration

Execute the SQL in `migrations.sql` in your Supabase SQL editor.

### 2. Start the Backend

```bash
python -m uvicorn backend_code.app:app --reload
```

## Usage

### Creating an API Key

```bash
# First, get your JWT token from the browser (see below)
curl -X POST http://localhost:8000/v1/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My API Key"}'
```

Response:
```json
{
  "key": "rest-abc123...",
  "key_prefix": "rest-abc123...",
  "warning": "Save this key securely - it will not be shown again"
}
```

**Save the key!** It's only shown once.

### Using the API

#### With OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="rest-abc123..."  # Your API key
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "What is 2+2?"}]
)

print(response.choices[0].message.content)
print(f"Provider: {response.restruct['provider']}")
```

#### With curl

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer rest-abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

#### With Profile-Based Routing

```python
response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    extra_body={"restruct": {"profile": "cost-optimized"}}
)
```

#### Manual Model Selection

```python
response = client.chat.completions.create(
    model="google:gemini-2.5-flash-lite",
    messages=[{"role": "user", "content": "Hello"}]
)
```

## API Endpoints

### Chat Completions

**POST /v1/chat/completions**

OpenAI-compatible chat completions with smart routing.

Request:
```json
{
  "model": "auto",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "restruct": {
    "profile": "cost-optimized"  // Optional
  }
}
```

Response: OpenAI format with extra `restruct` metadata

### Models

**GET /v1/models**

List all available models.

### API Key Management

**POST /v1/keys**

Create a new API key. Requires JWT authentication.

**GET /v1/keys**

List your API keys. Requires JWT or API key authentication.

**DELETE /v1/keys/{key_id}**

Delete an API key. Requires JWT or API key authentication.

## Getting Your JWT Token (for creating API keys)

1. Open your browser's Developer Tools (F12)
2. Go to Application → Local Storage
3. Find `sb-<project>-auth-token`
4. Copy the `access_token` value

Use this JWT to create your first API key. After that, use the API key for all requests.

## Authentication

Two methods:

1. **JWT Token** (short-lived, ~1 hour)
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **API Key** (long-lived, recommended)
   ```
   Authorization: Bearer rest-abc123...
   ```

## Testing

```bash
python backend_code/test_api.py
```

Set `TEST_JWT_TOKEN` environment variable for authenticated tests:

```bash
export TEST_JWT_TOKEN="your_jwt_token"
python backend_code/test_api.py
```
