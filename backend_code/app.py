"""
FastAPI app: orchestrates routing + inference.
Minimal endpoints, no error handling (errors will bubble up).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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


@app.get("/")
def root():
    """Health check."""
    return {
        "status": "online",
        "service": "Restruct Model Router",
        "version": "0.1.0"
    }


@app.post("/chat")
def chat(body: dict):
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

    prompt = body.get("prompt")
    router_mode = body.get("router_mode", "auto")
    model_override = body.get("model_override")
    conversation_id = body.get("conversation_id")
    user_id = body.get("user_id", "6785c292-273b-4001-9c1f-a6ff9e63979e")
    profile = body.get("profile", "default")

    if not conversation_id:
        conversation = create_conversation(
            user_id=user_id,
            title="New Chat"
        )
        conversation_id = conversation['id']

    add_message(
        conversation_id=conversation_id,
        role="user",
        content=prompt
    )

    model_choice = resolve_model_choice(router_mode, model_override, prompt)

    response_text = inference(model_choice, prompt)

    add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=response_text,
        model=model_choice["model_name"],
        provider=model_choice["vendor"],
        profile_name=profile,
        metadata={
            "score": model_choice["score"],
            "router_mode": router_mode
        }
    )

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
def list_conversations(user_id: str = "6785c292-273b-4001-9c1f-a6ff9e63979e"):
    conversations = get_user_conversations(user_id)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: str):
    messages = get_conversation_messages(conversation_id)
    return {"messages": messages}


@app.post("/conversations")
def new_conversation(user_id: str = "6785c292-273b-4001-9c1f-a6ff9e63979e", title: str = "New Chat"):
    conversation = create_conversation(user_id=user_id, title=title)
    return {"conversation": conversation}


def resolve_model_choice(router_mode: str, model_override: Optional[str], prompt: str):
    """
    Decide how to obtain a model: router-driven or manual override.
    """
    if router_mode == "manual":
        if not model_override:
            raise ValueError("Manual routing mode requires a model selection.")

        if ":" not in model_override:
            raise ValueError("Model override must use 'provider:model_name' format.")

        provider, model_name = model_override.split(":", 1)
        return route_specific(provider, model_name)
    model, model_scores = route_with_llm(prompt)
    return model


# Mount frontend static files (go up one directory)
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
