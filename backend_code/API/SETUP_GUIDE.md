# Restruct API - Setup Guide

## What Was Implemented

A complete OpenAI-compatible API with persistent API key authentication, just like OpenRouter.

### Features
- ✅ OpenAI-compatible `/v1/chat/completions` endpoint
- ✅ Persistent API keys (never expire)
- ✅ Dual authentication (JWT + API keys)
- ✅ Profile-based routing support
- ✅ Manual model selection
- ✅ Auto routing with smart model selection
- ✅ API key management endpoints (create/list/delete)
- ✅ Full test coverage

## Setup Steps

### Step 1: Run Database Migration

Open your Supabase SQL Editor and run the contents of:
```
backend_code/API/migrations.sql
```

This creates the `api_keys` table with proper RLS policies.

### Step 2: Test the Implementation

The API is already registered in `app.py` and ready to use!

```bash
# Run basic tests (no JWT needed)
python backend_code/test_api.py
```

## Quick Start for Users

### 1. Get a JWT Token

Users need to log in to your web app first, then:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Copy their JWT from `sb-*-auth-token`

### 2. Create an API Key

```bash
curl -X POST http://localhost:8000/v1/keys \
  -H "Authorization: Bearer JWT_TOKEN_HERE" \
  -d "name=My First Key"
```

Response includes the API key (shown only once):
```json
{
  "key": "rest-abc123...",
  "key_prefix": "rest-abc...",
  "warning": "Save this key securely - it will not be shown again"
}
```

### 3. Use the API

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="rest-abc123..."  # Their persistent API key
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "What is 2+2?"}]
)

print(response.choices[0].message.content)
```

## Files Created/Modified

### New Files
1. `backend_code/API/migrations.sql` - Database schema
2. `backend_code/API/api_keys.py` - API key management logic (110 lines)
3. `backend_code/API/README.md` - User-facing documentation
4. `backend_code/API/SETUP_GUIDE.md` - This file

### Modified Files
1. `backend_code/API/router.py` - Added authentication + key endpoints
2. `backend_code/test_api.py` - Added API key tests

### Existing Files (no changes needed)
- `backend_code/API/__init__.py`
- `backend_code/API/schemas.py`
- `backend_code/API/openai_compat.py`
- `backend_code/app.py` (already has router registered)

## API Key Workflow

```
User Action              Endpoint                   Auth Method
============================================================
1. Create API key    →   POST /v1/keys          →   JWT token
2. Use API           →   POST /v1/chat/...      →   API key
3. List keys         →   GET /v1/keys           →   API key
4. Delete key        →   DELETE /v1/keys/{id}   →   API key
```

## Security Features

- ✅ Keys are hashed (SHA-256) before storage
- ✅ Full keys never stored in database
- ✅ Keys only shown once at creation
- ✅ RLS policies ensure users only see their own keys
- ✅ Last used timestamp for monitoring
- ✅ Active/inactive status for revocation

## Next Steps (Optional)

For production, you might want to add:
1. Rate limiting per API key
2. Usage tracking/billing
3. Key expiration dates
4. UI in web app for key management
5. Email notifications for key creation

## Testing with Real Requests

After running the SQL migration, you can test end-to-end:

1. Get your JWT token from the browser
2. Create an API key:
   ```bash
   curl -X POST http://localhost:8000/v1/keys \
     -H "Authorization: Bearer YOUR_JWT" \
     -d "name=Test Key"
   ```
3. Copy the returned key
4. Test chat completions:
   ```bash
   curl -X POST http://localhost:8000/v1/chat/completions \
     -H "Authorization: Bearer rest-YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "auto",
       "messages": [{"role": "user", "content": "Hello"}]
     }'
   ```

Done! 🎉
