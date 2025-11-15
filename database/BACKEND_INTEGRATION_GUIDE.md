# Backend Database Integration Guide

This guide shows you exactly what code to add to integrate Supabase into your backend.

## Step 1: Update `backend_code/app.py`

### 1.1 Add Database Import (Line 14)

**Add this import:**
```python
from backend_code.database import (
    create_conversation,
    add_message,
    get_user_conversations,
    get_conversation_messages
)
```

**Your imports section should look like:**
```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os

from backend_code.router import route, route_specific, route_with_llm
from backend_code.inference import inference
from backend_code.database import (
    create_conversation,
    add_message,
    get_user_conversations,
    get_conversation_messages
)
```

---

### 1.2 Update ChatRequest Model (Line 28)

**Replace the current ChatRequest with:**
```python
class ChatRequest(BaseModel):
    prompt: str
    priority: Optional[str] = "balanced"
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    router_mode: Optional[str] = "auto"
    model_override: Optional[str] = None

    # NEW: Add these fields for database integration
    conversation_id: Optional[str] = None  # If None, creates new conversation
    user_id: str = "test-user-123"  # For now, hardcoded. Later: from auth token
    profile: Optional[str] = "default"  # Which routing profile was used
```

---

### 1.3 Update `/chat` Endpoint (Line 47)

**Replace the entire `/chat` endpoint with:**

```python
@app.post("/chat")
def chat(request: ChatRequest):
    """
    Main chat endpoint with database persistence.

    Returns format expected by frontend:
    {
        "output": str,
        "model": str,
        "provider": str,
        "routing_metadata": {"score": float},
        "conversation_id": str  # NEW
    }
    """

    # 1. Get or create conversation
    if not request.conversation_id:
        conversation = create_conversation(
            user_id=request.user_id,
            title="New Chat"  # Frontend can update this later
        )
        conversation_id = conversation['id']
    else:
        conversation_id = request.conversation_id

    # 2. Save user message to database
    add_message(
        conversation_id=conversation_id,
        role="user",
        content=request.prompt
    )

    # 3. Route and get model choice
    model_choice = resolve_model_choice(request)

    # 4. Call LLM to get response
    response_text = inference(model_choice, request.prompt)

    # 5. Save assistant response to database
    add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=response_text,
        model=model_choice["model_name"],
        provider=model_choice["vendor"],
        profile_name=request.profile,
        metadata={
            "score": model_choice["score"],
            "router_mode": request.router_mode
        }
    )

    # 6. Return response to frontend
    return {
        "output": response_text,
        "model": model_choice["model_name"],
        "provider": model_choice["vendor"],
        "routing_metadata": {
            "score": model_choice["score"]
        },
        "conversation_id": conversation_id  # NEW: Return so frontend knows the ID
    }
```

---

### 1.4 Add New Endpoints for Conversation Management (Add after `/chat`)

**Add these new endpoints:**

```python
@app.get("/conversations")
def list_conversations(user_id: str = "test-user-123"):
    """
    Get all conversations for a user.

    Returns:
    [
        {
            "id": "uuid",
            "title": "Chat about Python",
            "created_at": "2025-01-14T...",
            "updated_at": "2025-01-14T..."
        },
        ...
    ]
    """
    conversations = get_user_conversations(user_id)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: str):
    """
    Get all messages in a conversation.

    Returns:
    [
        {
            "id": "uuid",
            "role": "user",
            "content": "What is Python?",
            "created_at": "2025-01-14T..."
        },
        {
            "id": "uuid",
            "role": "assistant",
            "content": "Python is a programming language...",
            "model": "gpt-4",
            "provider": "openai",
            "created_at": "2025-01-14T..."
        },
        ...
    ]
    """
    messages = get_conversation_messages(conversation_id)
    return {"messages": messages}


@app.post("/conversations")
def new_conversation(user_id: str = "test-user-123", title: str = "New Chat"):
    """
    Manually create a new conversation.

    Request body:
    {
        "user_id": "test-user-123",  # optional for now
        "title": "Chat about Python"  # optional
    }
    """
    conversation = create_conversation(user_id=user_id, title=title)
    return {"conversation": conversation}
```

---

## Summary of Changes

### What Changed:
1. ✅ Added database imports
2. ✅ Added `conversation_id` and `user_id` to ChatRequest
3. ✅ Updated `/chat` to save messages to database
4. ✅ Added `/conversations` endpoint to list all chats
5. ✅ Added `/conversations/{id}/messages` to get message history
6. ✅ Added `/conversations` POST to create new chat

### What Stays the Same:
- Router logic (no changes)
- Inference logic (no changes)
- Frontend compatibility (response format unchanged, just added `conversation_id`)

---

## Testing the Changes

### 1. Test Database Connection

Create `test_db_connection.py`:
```python
from backend_code.database import supabase

try:
    result = supabase.table("conversations").select("*").limit(1).execute()
    print("✓ Database connected successfully!")
except Exception as e:
    print(f"✗ Database error: {e}")
```

Run: `python test_db_connection.py`

### 2. Test Chat Endpoint (with Postman or curl)

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the capital of France?",
    "user_id": "test-user-123"
  }'
```

**Expected response:**
```json
{
  "output": "The capital of France is Paris.",
  "model": "gpt-4",
  "provider": "openai",
  "routing_metadata": {"score": 0.95},
  "conversation_id": "uuid-here"  ← NEW!
}
```

### 3. Test Get Conversations

```bash
curl http://localhost:8000/conversations?user_id=test-user-123
```

### 4. Test Get Messages

```bash
curl http://localhost:8000/conversations/{conversation-id}/messages
```

---

## Temporary Hardcoded User ID

For now, we're using `user_id="test-user-123"` as a placeholder.

**Later, when you add authentication:**
- Replace with real user ID from JWT token
- Get it from `request.headers['Authorization']`
- Verify with Supabase auth

---

## Next Steps After Integration

Once you've made these changes:
1. ✅ Start the server: `uvicorn backend_code.app:app --reload`
2. ✅ Test the endpoints
3. ✅ Check Supabase Table Editor to see data appearing
4. ✅ Move to frontend integration (conversation history UI)

---

## Troubleshooting

**"Module 'backend_code.database' not found"**
- Make sure you created `backend_code/database.py`
- Check file exists and has no typos

**"Missing SUPABASE_URL"**
- Add credentials to `.env` file
- Make sure `.env` is in project root

**"Row Level Security policy violation"**
- This happens because we don't have authentication yet
- For testing, you can disable RLS temporarily in Supabase
- Go to Table Editor → Select table → RLS is enabled toggle

**Messages not appearing in database**
- Check Supabase logs in Dashboard
- Make sure migrations ran successfully
- Verify conversation_id is being passed correctly
