"""
FastAPI app: orchestrates routing + inference.
Minimal endpoints, no error handling (errors will bubble up).
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional, List
from contextlib import asynccontextmanager
import asyncio
import os
import re
from uuid import uuid4

import backend_code.router as router
import backend_code.inference as inference

import atexit
import httpx
from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client
from supabase_auth.errors import AuthApiError

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


async def get_conversation_messages(conversation_id: str) -> list:
    def _query():
        return (
            supabase.table("messages")
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )

    result = await asyncio.to_thread(_query)
    messages = []
    for message in result.data:
        msg = {
            "role": message.get("role") or "user",
            "content": message.get("content") or ""
        }
        if message.get("model"):
            msg["model"] = message["model"]
        if message.get("provider"):
            msg["provider"] = message["provider"]
        if message.get("metadata"):
            msg["metadata"] = message["metadata"]
        if message.get("created_at"):
            msg["created_at"] = message["created_at"]
        messages.append(msg)
    return messages


async def add_message(conversation_id: str, role: str, content: str, model: str = None, provider: str = None, profile_name: str = None, metadata: dict = None, message_group_id: str = None) -> dict:
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
    if message_group_id:
        message_data["message_group_id"] = message_group_id

    def _insert():
        return supabase.table("messages").insert(message_data).execute()

    result = await asyncio.to_thread(_insert)

    # Update conversation stats for assistant messages
    if role == "assistant" and metadata:
        await update_conversation_stats(conversation_id, model, metadata)

    return result.data[0]


async def update_conversation_stats(conversation_id: str, model: str, metadata: dict):
    """Update aggregated stats on the conversation."""
    def _select():
        return supabase.table("conversations").select("stats").eq("id", conversation_id).execute()

    conv = await asyncio.to_thread(_select)
    current_stats = (conv.data[0].get("stats") if conv.data else None) or {
        "input_tokens": 0,
        "output_tokens": 0,
        "total_cost": 0,
        "models_used": [],
        "message_count": 0,
        "routing_times": [],
        "response_times": []
    }

    current_stats["input_tokens"] += metadata.get("input_tokens", 0)
    current_stats["output_tokens"] += metadata.get("output_tokens", 0)
    current_stats["total_cost"] += metadata.get("cost", 0)
    current_stats["message_count"] += 1
    if model and model not in current_stats["models_used"]:
        current_stats["models_used"].append(model)

    # Track routing and response times
    if "routing_times" not in current_stats:
        current_stats["routing_times"] = []
    if "response_times" not in current_stats:
        current_stats["response_times"] = []

    if metadata.get("routing_time_ms"):
        current_stats["routing_times"].append(metadata["routing_time_ms"])
    if metadata.get("inference_time_ms"):
        current_stats["response_times"].append(metadata["inference_time_ms"])

    def _update():
        return supabase.table("conversations").update({"stats": current_stats}).eq("id", conversation_id).execute()

    await asyncio.to_thread(_update)


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
    
    print("[OK] Using Gemini API routing")
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


# Handle Supabase auth errors and return them as proper HTTP responses
@app.exception_handler(AuthApiError)
async def auth_error_handler(request, exc: AuthApiError):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={"detail": str(exc)})


async def get_user_from_token(authorization: str) -> dict:
    """Extract user from JWT token in Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]

    def _get_user():
        return supabase.auth.get_user(token)

    response = await asyncio.to_thread(_get_user)
    if response and response.user:
        return response.user
    return None


@app.get("/")
def root():
    """Health check."""
    return {
        "status": "online",
        "service": "Restruct Model Router",
        "version": "0.1.0"
    }


@app.post("/chat")
async def chat(body: dict, authorization: str = Header(None)):
    """Single model chat endpoint."""
    import time

    prompt = body.get("prompt")
    router_mode = body.get("router_mode", "auto")
    model_override = body.get("model_override")
    conversation_id = body.get("conversation_id")
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = user.id
    profile = body.get("profile", "default")

    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")

    # Add user message to conversation
    await add_message(
        conversation_id=conversation_id,
        role="user",
        content=prompt
    )
    conversation = await get_conversation_messages(conversation_id)

    # PHASE 1: ROUTING
    routing_start = time.time()
    model_choice = resolve_model_choice(router_mode, model_override, conversation)
    routing_time = time.time() - routing_start

    # PHASE 2: INFERENCE
    inference_start = time.time()
    response_data = await inference.inference(model_choice, conversation)
    inference_time = time.time() - inference_start

    response_text = response_data.get("text") or ""
    if not response_text:
        raise HTTPException(status_code=500, detail="Model returned empty response")

    input_tokens = response_data.get("input_tokens") or 0
    output_tokens = response_data.get("output_tokens") or 0

    # Calculate cost
    input_cost_per_token = model_choice["config"].get("input_token_cost", 0.0)
    output_cost_per_token = model_choice["config"].get("output_token_cost", 0.0)
    total_cost = (input_tokens * input_cost_per_token) + (output_tokens * output_cost_per_token)

    # Save assistant message to database with full stats
    await add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=response_text,
        model=model_choice["model_name"],
        provider=model_choice["vendor"],
        profile_name=profile,
        metadata={
            "score": model_choice.get("score", 0),
            "router_mode": router_mode,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": total_cost,
            "routing_time_ms": round(routing_time * 1000, 2),
            "inference_time_ms": round(inference_time * 1000, 2)
        }
    )

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


@app.post("/chat/batch")
async def chat_batch(body: dict, authorization: str = Header(None)):
    """Batch endpoint for parallel multi-model responses."""
    import time

    prompt = body.get("prompt")
    model_overrides = body.get("model_overrides")  # List of model override strings
    conversation_id = body.get("conversation_id")
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = user.id
    profile = body.get("profile", "default")

    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")
    if not model_overrides or not isinstance(model_overrides, list):
        raise HTTPException(status_code=400, detail="model_overrides must be a non-empty list")

    # Save user message once
    await add_message(
        conversation_id=conversation_id,
        role="user",
        content=prompt
    )
    conversation = await get_conversation_messages(conversation_id)

    # Generate a unique message group ID for this batch
    message_group_id = str(uuid4())

    # Process all models in parallel
    async def process_model(model_override: str):
        try:
            # PHASE 1: ROUTING
            routing_start = time.time()
            model_choice = resolve_model_choice("manual", model_override, conversation)
            routing_time = time.time() - routing_start

            # PHASE 2: INFERENCE
            inference_start = time.time()
            response_data = await inference.inference(model_choice, conversation)
            inference_time = time.time() - inference_start

            response_text = response_data.get("text") or ""
            if not response_text:
                return {
                    "model_override": model_override,
                    "error": "Model returned empty response"
                }

            input_tokens = response_data.get("input_tokens") or 0
            output_tokens = response_data.get("output_tokens") or 0

            # Calculate cost
            input_cost_per_token = model_choice["config"].get("input_token_cost", 0.0)
            output_cost_per_token = model_choice["config"].get("output_token_cost", 0.0)
            total_cost = (input_tokens * input_cost_per_token) + (output_tokens * output_cost_per_token)

            # Save assistant message to database with full stats
            await add_message(
                conversation_id=conversation_id,
                role="assistant",
                content=response_text,
                model=model_choice["model_name"],
                provider=model_choice["vendor"],
                profile_name=profile,
                metadata={
                    "score": model_choice.get("score", 0),
                    "router_mode": "manual",
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost": total_cost,
                    "routing_time_ms": round(routing_time * 1000, 2),
                    "inference_time_ms": round(inference_time * 1000, 2)
                },
                message_group_id=message_group_id
            )

            return {
                "status": "complete",
                "model_override": model_override,
                "output": response_text,
                "model": model_choice["model_name"],
                "provider": model_choice["vendor"],
                "routing_metadata": {
                    "score": model_choice.get("score", 0)
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
        except Exception as e:
            return {
                "model_override": model_override,
                "error": str(e)
            }

    # Execute all model requests in parallel
    results = await asyncio.gather(*[process_model(model_override) for model_override in model_overrides])

    return {
        "status": "complete",
        "conversation_id": conversation_id,
        "message_group_id": message_group_id,
        "results": results
    }


@app.get("/conversations")
async def list_conversations(authorization: str = Header(None)):
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conversations = get_user_conversations(user.id)
    return {"conversations": conversations}


@app.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, authorization: str = Header(None)):
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Verify conversation belongs to this user
    conv = supabase.table("conversations").select("user_id").eq("id", conversation_id).execute()
    if not conv.data or conv.data[0]["user_id"] != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = get_conversation_messages(conversation_id)
    return {"messages": messages}


@app.post("/conversations")
async def new_conversation(body: dict, authorization: str = Header(None)):
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    title = body.get("title") or "New Chat"
    conversation = create_conversation(user_id=user.id, title=title)
    return {"conversation": conversation}


@app.patch("/conversations/{conversation_id}")
async def update_conversation(conversation_id: str, body: dict, authorization: str = Header(None)):
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conv = supabase.table("conversations").select("user_id").eq("id", conversation_id).execute()
    if not conv.data or conv.data[0]["user_id"] != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    title = body.get("title")
    if title:
        updated = update_conversation_title(conversation_id, title)
        return {"conversation": updated}
    return {"conversation": conv.data[0]}


@app.get("/profiles")
async def list_profiles(authorization: str = Header(None)):
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    profiles = get_routing_profiles(user.id)
    return {"profiles": profiles}


@app.post("/profiles")
async def create_profile(body: dict, authorization: str = Header(None)):
    name = body.get("name")
    graph_state = body.get("graph_state")
    if not name:
        raise HTTPException(status_code=400, detail="Profile name is required")
    if not isinstance(graph_state, dict):
        raise HTTPException(status_code=400, detail="Graph state is required for routing profiles")

    description = body.get("description")
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    profile = create_routing_profile(
        user_id=user.id,
        name=name,
        description=description,
        graph_state=graph_state
    )

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


# =============================================================================
# AUTHENTICATION ENDPOINTS (New functionality for sign in / sign up)
# =============================================================================

from pydantic import BaseModel, EmailStr


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


@app.post("/auth/signup")
def auth_signup(body: SignUpRequest):
    """Create a new user account."""
    response = supabase.auth.sign_up({
        "email": body.email,
        "password": body.password
    })

    if response.user is None:
        raise HTTPException(status_code=400, detail="Signup failed - email is already registered")

    return {
        "success": True,
        "user": {
            "id": response.user.id,
            "email": response.user.email
        },
        "session": {
            "access_token": response.session.access_token if response.session else None,
            "refresh_token": response.session.refresh_token if response.session else None
        }
    }


@app.post("/auth/signin")
def auth_signin(body: SignInRequest):
    """Sign in an existing user."""
    response = supabase.auth.sign_in_with_password({
        "email": body.email,
        "password": body.password
    })

    if response.user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "success": True,
        "user": {
            "id": response.user.id,
            "email": response.user.email
        },
        "session": {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }
    }


@app.post("/auth/signout")
def auth_signout(authorization: str = Header(None)):
    """Sign out the current user."""
    if authorization and authorization.startswith("Bearer "):
        supabase.auth.sign_out()
    return {"success": True}


@app.get("/auth/me")
async def auth_me(authorization: str = Header(None)):
    """Get the currently authenticated user."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {
        "success": True,
        "user": {
            "id": user.id,
            "email": user.email
        }
    }


@app.post("/auth/refresh")
def auth_refresh(body: dict):
    """Refresh an access token using a refresh token."""
    refresh_token = body.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required")

    response = supabase.auth.refresh_session(refresh_token)

    if response.session is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    return {
        "success": True,
        "session": {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }
    }


# =============================================================================
# END AUTHENTICATION ENDPOINTS
# =============================================================================


# Mount frontend static files (go up one directory)
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
