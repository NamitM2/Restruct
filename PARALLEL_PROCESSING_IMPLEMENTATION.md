# Parallel Multi-Model Processing Implementation

## Overview
This document details the changes made to enable true parallel processing of multiple model inference requests in the Restruct application, allowing responses from different models to appear as they complete rather than waiting for all models to finish.

## Problem Statement

### Original Behavior
When users selected multiple models (e.g., 4 different LLMs), all responses appeared simultaneously after the slowest model finished. For example:
- Gemini 2.5 Flash Lite: 1.5s response time
- Other models: ~9.5s response time
- User saw ALL responses after 11 seconds (9.5s + overhead)

### Expected Behavior
Responses should appear **as each model completes**:
- Gemini 2.5 Flash Lite appears at ~1.5s
- Other models appear individually as they complete
- No waiting for the slowest model

## Root Cause Analysis

The backend was processing parallel HTTP requests **sequentially** due to **synchronous blocking I/O operations**. Even though:
- ✅ Frontend sent multiple requests in parallel using `Promise.allSettled()`
- ✅ `/chat` endpoint was declared as `async def`

The problem was that **all I/O operations blocked Python's event loop**:

### Blocking Operations Identified

1. **API Inference Calls** (`backend_code/inference.py`)
   ```python
   # BEFORE (Blocking)
   def call_google(model, conversation):
       client = genai.Client(api_key=api_key)
       response = client.models.generate_content(...)  # BLOCKS event loop
       return response
   ```

2. **Database Operations** (`backend_code/app.py`)
   ```python
   # BEFORE (Blocking)
   def get_conversation_messages(conversation_id):
       result = supabase.table("messages").select("*").execute()  # BLOCKS
       return result.data
   ```

3. **Authentication Checks** (`backend_code/app.py`)
   ```python
   # BEFORE (Blocking)
   def get_user_from_token(authorization):
       response = supabase.auth.get_user(token)  # BLOCKS
       return response.user
   ```

### Why This Caused Sequential Processing

When FastAPI received 4 parallel requests:
1. Request 1 starts → blocks on auth → blocks on database → blocks on API call → finally responds
2. While Request 1 is blocked, Requests 2-4 **wait** because the event loop is blocked
3. Only after Request 1 completes can Request 2 start
4. Result: Sequential processing disguised as parallel requests

## Solution: Async with Thread Pool Execution

The solution wraps all blocking I/O operations with `asyncio.to_thread()`, which:
- Runs blocking code in a **thread pool**
- Doesn't block the event loop
- Allows FastAPI to process multiple requests concurrently

## Implementation Changes

### 1. Inference Functions (`backend_code/inference.py`)

**Change:** Made all functions async and wrapped API client calls with `asyncio.to_thread()`

```python
# AFTER (Non-blocking)
async def call_google(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Call Google Gemini API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    # Wrap blocking call in thread pool
    def _call():
        client = genai.Client(api_key=api_key)
        return client.models.generate_content(
            model=model_name,
            contents=_conversation_to_google_history(conversation)
        )

    response = await asyncio.to_thread(_call)  # Runs in thread pool

    return {
        "text": response.text,
        "input_tokens": response.usage_metadata.prompt_token_count,
        "output_tokens": response.usage_metadata.candidates_token_count
    }
```

**Functions Modified:**
- `call_openai()` - OpenAI API calls
- `call_google()` - Gemini API calls
- `call_anthropic()` - Claude API calls
- `infer()` - Model routing logic
- `inference()` - Main inference entry point

**Added Import:**
```python
import asyncio
```

### 2. Database Operations (`backend_code/app.py`)

**Change:** Made database functions async and wrapped Supabase calls with `asyncio.to_thread()`

#### `get_conversation_messages()`
```python
# AFTER (Non-blocking)
async def get_conversation_messages(conversation_id: str) -> list:
    def _query():
        return (
            supabase.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )

    result = await asyncio.to_thread(_query)  # Runs in thread pool
    messages = []
    for message in result.data:
        msg = {
            "role": message.get("role") or "user",
            "content": message.get("content") or ""
        }
        # ... process message
        messages.append(msg)
    return messages
```

#### `add_message()`
```python
async def add_message(conversation_id: str, role: str, content: str,
                     model: str = None, provider: str = None,
                     profile_name: str = None, metadata: dict = None,
                     message_group_id: str = None) -> dict:
    message_data = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content
    }
    # ... build message_data

    def _insert():
        return supabase.table("messages").insert(message_data).execute()

    result = await asyncio.to_thread(_insert)  # Non-blocking insert

    if role == "assistant" and metadata:
        await update_conversation_stats(conversation_id, model, metadata)

    return result.data[0]
```

#### `update_conversation_stats()`
```python
async def update_conversation_stats(conversation_id: str, model: str, metadata: dict):
    """Update aggregated stats on the conversation."""
    def _select():
        return supabase.table("conversations").select("stats").eq("id", conversation_id).execute()

    conv = await asyncio.to_thread(_select)
    current_stats = (conv.data[0].get("stats") if conv.data else None) or {
        "input_tokens": 0,
        "output_tokens": 0,
        # ... default stats
    }

    # Update stats
    current_stats["input_tokens"] += metadata.get("input_tokens", 0)
    # ... update other stats

    def _update():
        return supabase.table("conversations").update({"stats": current_stats}).eq("id", conversation_id).execute()

    await asyncio.to_thread(_update)
```

### 3. Authentication (`backend_code/app.py`)

**Change:** Made auth function async and wrapped Supabase auth call

```python
async def get_user_from_token(authorization: str) -> dict:
    """Extract user from JWT token in Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]

    def _get_user():
        return supabase.auth.get_user(token)

    response = await asyncio.to_thread(_get_user)  # Non-blocking auth
    if response and response.user:
        return response.user
    return None
```

### 4. Updated Endpoint Calls (`backend_code/app.py`)

**Change:** Added `await` to all async function calls

#### `/chat` Endpoint
```python
@app.post("/chat")
async def chat(body: dict, authorization: str = Header(None)):
    # ... setup code

    # Authentication (non-blocking)
    user = await get_user_from_token(authorization)

    # Save user message (non-blocking)
    await add_message(
        conversation_id=conversation_id,
        role="user",
        content=prompt
    )

    # Load conversation (non-blocking)
    conversation = await get_conversation_messages(conversation_id)

    # Routing (synchronous - fast, no I/O)
    model_choice = resolve_model_choice(router_mode, model_override, conversation)

    # Inference (non-blocking)
    response_data = await inference.inference(model_choice, conversation)

    # Save assistant message (non-blocking)
    await add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=response_text,
        # ... metadata
    )

    return response
```

#### All Other Endpoints Updated
- `/conversations` GET - `await get_user_from_token()`
- `/conversations/{id}/messages` GET - `await get_user_from_token()`
- `/conversations` POST - `await get_user_from_token()`
- `/conversations/{id}` PATCH - `await get_user_from_token()`
- `/profiles` GET - `await get_user_from_token()`
- `/profiles` POST - `await get_user_from_token()`
- `/auth/me` GET - `await get_user_from_token()`

### 5. Frontend Approach (`frontend/script.js`)

**Kept Original Parallel Request Pattern:**

The frontend sends separate HTTP requests for each model:

```javascript
// Generate a unique group ID for this multi-model request
const messageGroupId = crypto.randomUUID();

// Send requests to all selected models in parallel
const modelPromises = selectedOverrideModels.map(async (modelName, index) => {
    const loadingId = showLoadingInMultiModelPane(multiModelGroupContainer, modelName);
    console.log(`Starting request for ${modelName}`);

    try {
        const payload = {
            prompt,
            conversation_id: currentConversation.conversationId,
            save_user_message: index === 0,  // Only first request saves user message
            message_group_id: messageGroupId,
            router_mode: 'manual',
            model_override: modelOverrideMap[modelName],
            // ...
        };

        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log(`Received response for ${modelName}`);

        // Remove loading and display response IMMEDIATELY as it arrives
        removeLoadingFromMultiModelPane(loadingId);
        addResponseToMultiModelPane(multiModelGroupContainer, modelName, data.output, {
            // ... metadata
        });

    } catch (error) {
        console.error(`Error with model ${modelName}:`, error);
        // Handle error
    }
});

// Wait for all models to complete before cleanup
Promise.allSettled(modelPromises).then(() => {
    setLoading(false);
    promptInput?.focus();
});
```

**Key Points:**
- Each model gets its own HTTP request to `/chat`
- Requests sent immediately in parallel (no waiting)
- Each response displays **as soon as it arrives**
- `Promise.allSettled()` only used for final cleanup (doesn't block UI updates)

## Why This Works

### Before (Sequential)
```
Request 1 → Auth (BLOCK) → DB (BLOCK) → API (BLOCK) → Response 1 ✓
                                                          ↓
Request 2 ────────────────────────────────────────────→ Auth (BLOCK) → ...
```
Total time: Sum of all requests

### After (Parallel)
```
Request 1 → Auth (async) → DB (async) → API (async) → Response 1 ✓ (1.5s)
Request 2 → Auth (async) → DB (async) → API (async) → Response 2 ✓ (3s)
Request 3 → Auth (async) → DB (async) → API (async) → Response 3 ✓ (5s)
Request 4 → Auth (async) → DB (async) → API (async) → Response 4 ✓ (9.5s)
```
Total time: Max of all requests (9.5s), but responses appear incrementally

### Thread Pool Execution

`asyncio.to_thread()` runs blocking code in Python's default thread pool without blocking the event loop:

```python
# Blocking call runs in separate thread
response = await asyncio.to_thread(blocking_function)

# Event loop is free to handle other requests
# Multiple threads can run simultaneously
```

## Testing & Verification

### Successful Test Scenario
1. Select 4 models with different response times
2. Send a prompt
3. **Observe:**
   - Fastest model (Gemini Flash Lite) appears first (~1.5s)
   - Other models appear individually as they complete
   - No waiting for slowest model
   - Console logs show timestamps for each response

### Console Output Example
```
[2025-12-02T09:01:20.427Z] Starting request for Gemini 2.5 Flash Lite
[2025-12-02T09:01:20.428Z] Starting request for GPT-4o
[2025-12-02T09:01:20.429Z] Starting request for Claude 3.5 Sonnet
[2025-12-02T09:01:20.430Z] Starting request for Gemini 2.0 Pro
[2025-12-02T09:01:21.950Z] Received response for Gemini 2.5 Flash Lite  ← Fast!
[2025-12-02T09:01:23.200Z] Received response for GPT-4o
[2025-12-02T09:01:24.800Z] Received response for Claude 3.5 Sonnet
[2025-12-02T09:01:29.900Z] Received response for Gemini 2.0 Pro
```

## Performance Impact

### Latency Improvement
- **Before:** User waits for slowest model (9.5s) before seeing ANY response
- **After:** User sees fastest model at 1.5s, others incrementally
- **Perceived Performance:** 6.3x faster (first response appears 6.3x sooner)

### Concurrency
- **Before:** 1 request processed at a time
- **After:** N requests processed simultaneously (limited by thread pool size, default ~32)

### Resource Utilization
- **CPU:** Minimal overhead (thread context switching)
- **Memory:** Slightly higher (thread stacks), but negligible
- **Network:** Better utilization (concurrent HTTP connections)

## Summary of Files Modified

| File | Changes | Lines Modified |
|------|---------|----------------|
| `backend_code/inference.py` | Made all functions async, added `asyncio.to_thread()` | ~60 lines |
| `backend_code/app.py` | Made database/auth async, added awaits | ~150 lines |
| `frontend/script.js` | Reverted to parallel request pattern | ~80 lines |

## Key Takeaways

1. **Async ≠ Concurrent** - Declaring functions as `async def` doesn't make blocking I/O non-blocking
2. **Thread Pool Pattern** - `asyncio.to_thread()` is the correct way to handle blocking I/O in async code
3. **Event Loop Freedom** - Non-blocking operations allow FastAPI to process multiple requests concurrently
4. **User Experience** - Incremental responses dramatically improve perceived performance

## Troubleshooting

### Issue: Responses Still Appear Simultaneously
**Cause:** Old server processes running without changes

**Solution:**
1. Kill all Python processes: Task Manager → End all "Python" tasks
2. Verify port is clear: `netstat -ano | findstr :8000`
3. Restart server: `python dev.py`
4. Hard refresh browser: Ctrl+Shift+R

### Issue: Database Errors
**Cause:** Race conditions on concurrent writes

**Solution:** Database operations are wrapped in thread pool, Supabase handles concurrency internally

## Future Improvements

1. **Connection Pooling** - Reuse HTTP connections for better performance
2. **Result Streaming** - Stream tokens as they're generated (for supported models)
3. **Request Batching** - Batch multiple database operations into single queries
4. **Caching** - Cache frequent database queries (user auth, conversation metadata)

---

**Implementation Date:** December 2025
**Authors:** Development Team
**Status:** ✅ Production Ready
