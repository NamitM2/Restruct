"""
FastAPI app: orchestrates routing + inference.
Minimal endpoints, no error handling (errors will bubble up).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional, List
from contextlib import asynccontextmanager
import os
import re
from uuid import uuid4

import backend_code.router as router
import backend_code.inference as inference

import atexit
import httpx
from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_httpx_client = httpx.Client()
atexit.register(_httpx_client.close)
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
    ClientOptions(httpx_client=_httpx_client),
)


def create_conversation(user_id: str, title: str = "New Conversation") -> dict:
    result = supabase.table("conversations").insert({
        "user_id": user_id,
        "title": title
    }).execute()
    return result.data[0]


def get_user_conversations(user_id: str) -> list:
    result = supabase.table("conversations").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return result.data


def get_conversation_messages(conversation_id: str) -> list:
    result = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    messages = []
    for message in result.data:
        role = message.get("role") or "user"
        content = message.get("content") or ""
        messages.append({
            "role": role,
            "content": content
        })
    return messages


def add_message(conversation_id: str, role: str, content: str, model: str = None, provider: str = None, profile_name: str = None, metadata: dict = None) -> dict:
    message_data = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content
    }

    if model:
        message_data["model"] = model
    if provider:
        message_data["provider"] = provider
    if profile_name:
        message_data["profile_name"] = profile_name
    if metadata:
        message_data["metadata"] = metadata

    result = supabase.table("messages").insert(message_data).execute()
    return result.data[0]


def update_conversation_title(conversation_id: str, title: str) -> dict:
    result = supabase.table("conversations").update({"title": title}).eq("id", conversation_id).execute()
    return result.data[0]


def delete_conversation(conversation_id: str) -> None:
    supabase.table("conversations").delete().eq("id", conversation_id).execute()


def delete_message(message_id: str) -> None:
    supabase.table("messages").delete().eq("id", message_id).execute()


def slugify_profile_name(name: str) -> str:
    base = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or 'profile'
    suffix = uuid4().hex[:6]
    return f"{base}-{suffix}"


def create_routing_profile(user_id: str, name: str, description: Optional[str], graph_state: dict) -> dict:
    payload = {
        "user_id": user_id,
        "name": name,
        "description": description,
        "graph_state": graph_state,
        "slug": slugify_profile_name(name)
    }
    result = supabase.table("routing_profiles").insert(payload).execute()
    return result.data[0]


def get_routing_profiles(user_id: str) -> List[dict]:
    result = (
        supabase.table("routing_profiles")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Pre-load the local LLM router on startup for faster first request."""
    # Local PHI router disabled - using Gemini API for routing
    # TODO: Re-enable when GPU support is configured
    # import time
    # from backend_code.local_llm_router import get_local_router
    #
    # print("Initializing routing system...")
    # start = time.time()
    # router = get_local_router()
    # elapsed = (time.time() - start) * 1000
    #
    # if router.is_ready():
    #     mode = "GPU" if router.has_gpu() else "CPU"
    #     print(f"✓ Using local {mode} routing (loaded in {elapsed:.2f}ms)")
    # else:
    #     print(f"✓ Using Gemini API routing (Local model not loaded)")
    
    print("✓ Using Gemini API routing")
    yield


app = FastAPI(title="Restruct API", version="0.1.0", lifespan=lifespan)
DEFAULT_USER_ID = "6785c292-273b-4001-9c1f-a6ff9e63979e"

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
async def chat(body: dict):
    """Main chat endpoint."""
    import time

    prompt = body.get("prompt")
    router_mode = body.get("router_mode", "auto")
    model_override = body.get("model_override")
    conversation_id = body.get("conversation_id")
    user_id = body.get("user_id", DEFAULT_USER_ID)
    profile = body.get("profile", "default")

    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")

    # Add user message to conversation
    add_message(
        conversation_id=conversation_id,
        role="user",
        content=prompt
    )
    conversation = get_conversation_messages(conversation_id)

    # PHASE 1: ROUTING
    routing_start = time.time()
    model_choice = resolve_model_choice(router_mode, model_override, conversation)
    routing_time = time.time() - routing_start

    # PHASE 2: INFERENCE
    inference_start = time.time()
    response_data = inference.inference(model_choice, conversation)
    inference_time = time.time() - inference_start

    response_text = response_data["text"]
    input_tokens = response_data.get("input_tokens", 0)
    output_tokens = response_data.get("output_tokens", 0)

    # Save assistant message to database
    add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=response_text,
        model=model_choice["model_name"],
        provider=model_choice["vendor"],
        profile_name=profile,
        metadata={
            "score": model_choice.get("score", 0),
            "router_mode": router_mode
        }
    )

    # Calculate cost
    input_cost_per_token = model_choice["config"].get("input_token_cost", 0.0)
    output_cost_per_token = model_choice["config"].get("output_token_cost", 0.0)
    total_cost = (input_tokens * input_cost_per_token) + (output_tokens * output_cost_per_token)

    # Build response
    return {
        "status": "complete",
        "timestamp": time.time(),
        "output": response_text,
        "model": model_choice["model_name"],
        "provider": model_choice["vendor"],
        "conversation_id": conversation_id,
        "routing_metadata": {
            "score": model_choice.get("score", 0),
            "routing_model": "gemini",
            "llm_scores": model_choice.get("llm_scores")
        },
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": total_cost
        },
        "timing": {
            "routing_time": round(routing_time * 1000, 2),
            "inference_time": round(inference_time * 1000, 2),
            "total_time_ms": round((routing_time + inference_time) * 1000, 2)
        }
    }


@app.get("/conversations")
def list_conversations(user_id: str = DEFAULT_USER_ID):
    conversations = get_user_conversations(user_id)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
def get_messages(conversation_id: str):
    messages = get_conversation_messages(conversation_id)
    return {"messages": messages}


@app.post("/conversations")
def new_conversation(user_id: str = DEFAULT_USER_ID, title: str = "New Chat"):
    conversation = create_conversation(user_id=user_id, title=title)
    return {"conversation": conversation}


@app.get("/profiles")
def list_profiles(user_id: str = DEFAULT_USER_ID):
    profiles = get_routing_profiles(user_id)
    return {"profiles": profiles}


@app.post("/profiles")
def create_profile(body: dict):
    name = body.get("name")
    graph_state = body.get("graph_state")
    if not name:
        raise HTTPException(status_code=400, detail="Profile name is required")
    if not isinstance(graph_state, dict):
        raise HTTPException(status_code=400, detail="Graph state is required for routing profiles")

    description = body.get("description")
    user_id = body.get("user_id", DEFAULT_USER_ID)

    try:
        profile = create_routing_profile(
            user_id=user_id,
            name=name,
            description=description,
            graph_state=graph_state
        )
    except Exception as exc:
        print(f"Error creating routing profile: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to save routing profile: {str(exc)}") from exc

    return {"profile": profile}


def resolve_model_choice(router_mode: str, model_override: Optional[str], conversation):
    """
    Decide how to obtain a model: router-driven or manual override.
    """
    if router_mode == "manual":
        if not model_override:
            raise ValueError("Manual routing mode requires a model selection.")

        if ":" not in model_override:
            raise ValueError("Model override must use 'provider:model_name' format.")

        provider, model_name = model_override.split(":", 1)
        return router.route_specific(provider, model_name)
    model, model_scores = router.route_with_llm(conversation)
    return model


@app.get("/models/info")
def get_model_info(provider: str, model_name: str):
    """Get display information for a specific model."""
    from backend_code.models_config import MODELS

    vendor_config = MODELS.get(provider)
    if not vendor_config:
        raise HTTPException(status_code=404, detail="Provider not found")

    model_config = vendor_config.get("models", {}).get(model_name)
    if not model_config:
        raise HTTPException(status_code=404, detail="Model not found")

    return {
        "success": True,
        "model_info": {
            "provider": provider,
            "model_name": model_name,
            "max_tokens": model_config.get("max_tokens", 0)
        }
    }


@app.get("/models/list")
def list_available_models():
    """List all available models."""
    from backend_code.models_config import MODELS

    models_list = []
    for provider, config in MODELS.items():
        for model_name, model_config in config.get("models", {}).items():
            models_list.append({
                "provider": provider,
                "model_name": model_name,
                "max_tokens": model_config.get("max_tokens", 0),
                "input_cost_per_million": model_config.get("input_token_cost", 0) * 1_000_000,
                "output_cost_per_million": model_config.get("output_token_cost", 0) * 1_000_000,
                "capabilities": model_config.get("capability_attributes", {})
            })

    return {
        "success": True,
        "models": models_list
    }


# Mount frontend static files (go up one directory)
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
