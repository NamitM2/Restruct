# app.py Changes - Side by Side Comparison

## Change 1: Add Database Import

### BEFORE (Line 14):
```python
from backend_code.router import route, route_specific, route_with_llm
from backend_code.inference import inference
```

### AFTER:
```python
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

## Change 2: Update ChatRequest Model

### BEFORE (Lines 28-34):
```python
class ChatRequest(BaseModel):
    prompt: str
    priority: Optional[str] = "balanced"
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    router_mode: Optional[str] = "auto"
    model_override: Optional[str] = None
```

### AFTER:
```python
class ChatRequest(BaseModel):
    prompt: str
    priority: Optional[str] = "balanced"
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    router_mode: Optional[str] = "auto"
    model_override: Optional[str] = None
    conversation_id: Optional[str] = None
    user_id: str = "test-user-123"
    profile: Optional[str] = "default"
```

---

## Change 3: Replace /chat Endpoint

### BEFORE (Lines 47-73):
```python
@app.post("/chat")
def chat(request: ChatRequest):
    """
    Main chat endpoint.

    Returns format expected by frontend:
    {
        "output": str,
        "model": str,
        "provider": str,
        "routing_metadata": {"score": float}
    }
    """

    model_choice = resolve_model_choice(request)

    response_text = inference(model_choice, request.prompt)

    # Format response for frontend
    return {
        "output": response_text,
        "model": model_choice["model_name"],
        "provider": model_choice["provider"],
        "routing_metadata": {
            "score": model_choice["score"]
        }
    }
```

### AFTER:
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
        "conversation_id": str
    }
    """

    # Get or create conversation
    if not request.conversation_id:
        conversation = create_conversation(
            user_id=request.user_id,
            title="New Chat"
        )
        conversation_id = conversation['id']
    else:
        conversation_id = request.conversation_id

    # Save user message
    add_message(
        conversation_id=conversation_id,
        role="user",
        content=request.prompt
    )

    # Route and get model choice
    model_choice = resolve_model_choice(request)

    # Call LLM
    response_text = inference(model_choice, request.prompt)

    # Save assistant response
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

    # Return response
    return {
        "output": response_text,
        "model": model_choice["model_name"],
        "provider": model_choice["vendor"],
        "routing_metadata": {
            "score": model_choice["score"]
        },
        "conversation_id": conversation_id
    }
```

---

## Change 4: Add New Endpoints

### ADD AFTER /chat endpoint (after line 73):

```python
@app.get("/conversations")
def list_conversations(user_id: str = "test-user-123"):
    conversations = get_user_conversations(user_id)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: str):
    messages = get_conversation_messages(conversation_id)
    return {"messages": messages}


@app.post("/conversations")
def new_conversation(user_id: str = "test-user-123", title: str = "New Chat"):
    conversation = create_conversation(user_id=user_id, title=title)
    return {"conversation": conversation}
```

---

## Quick Copy-Paste Section

If you want to just copy-paste, here's the complete updated file:

### Complete Updated app.py:

```python
"""
FastAPI app: orchestrates routing + inference.
Minimal endpoints, no error handling (errors will bubble up).
"""

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

app = FastAPI(title="Restruct API", version="0.1.0")

# CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    prompt: str
    priority: Optional[str] = "balanced"
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    router_mode: Optional[str] = "auto"
    model_override: Optional[str] = None
    conversation_id: Optional[str] = None
    user_id: str = "test-user-123"
    profile: Optional[str] = "default"


@app.get("/")
def root():
    """Health check."""
    return {
        "status": "online",
        "service": "Restruct Model Router",
        "version": "0.1.0"
    }


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
        "conversation_id": str
    }
    """

    # Get or create conversation
    if not request.conversation_id:
        conversation = create_conversation(
            user_id=request.user_id,
            title="New Chat"
        )
        conversation_id = conversation['id']
    else:
        conversation_id = request.conversation_id

    # Save user message
    add_message(
        conversation_id=conversation_id,
        role="user",
        content=request.prompt
    )

    # Route and get model choice
    model_choice = resolve_model_choice(request)

    # Call LLM
    response_text = inference(model_choice, request.prompt)

    # Save assistant response
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

    # Return response
    return {
        "output": response_text,
        "model": model_choice["model_name"],
        "provider": model_choice["vendor"],
        "routing_metadata": {
            "score": model_choice["score"]
        },
        "conversation_id": conversation_id
    }


@app.get("/conversations")
def list_conversations(user_id: str = "test-user-123"):
    """Get all conversations for a user."""
    conversations = get_user_conversations(user_id)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: str):
    """Get all messages in a conversation."""
    messages = get_conversation_messages(conversation_id)
    return {"messages": messages}


@app.post("/conversations")
def new_conversation(user_id: str = "test-user-123", title: str = "New Chat"):
    """Create a new conversation."""
    conversation = create_conversation(user_id=user_id, title=title)
    return {"conversation": conversation}


def resolve_model_choice(request: ChatRequest):
    """
    Decide how to obtain a model: router-driven or manual override.
    """
    if request.router_mode == "manual":
        if not request.model_override:
            raise ValueError("Manual routing mode requires a model selection.")

        if ":" not in request.model_override:
            raise ValueError("Model override must use 'provider:model_name' format.")

        provider, model_name = request.model_override.split(":", 1)
        return route_specific(provider, model_name)
    model, model_scores = route_with_llm(request.prompt)
    return model


# Mount frontend static files (go up one directory)
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
```

---

## Summary

**3 Main Changes:**
1. Import database functions
2. Update ChatRequest model (add 3 new fields)
3. Update /chat endpoint to save messages
4. Add 3 new endpoints for conversation management

**Test it:**
```bash
# Activate venv first
.\venv\Scripts\Activate.ps1

# Run server
uvicorn backend_code.app:app --reload

# Test in another terminal
curl -X POST http://localhost:8000/chat -H "Content-Type: application/json" -d '{"prompt":"Hello!"}'
```

Check Supabase Table Editor → you should see data in `conversations` and `messages` tables!
