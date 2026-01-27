"""
FastAPI app: orchestrates routing + inference.
Community profiles with ratings, tags, icons, and downloads.
"""

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from typing import Optional, List
from contextlib import asynccontextmanager
import asyncio
import os
import re
import json
from uuid import uuid4
from datetime import datetime, timedelta, timezone

import backend_code.router as router
import backend_code.inference as inference
import backend_code.profiles as profiles

# Wallet system imports
from backend_code.API.wallet import (
    calculate_cost,
    check_sufficient_balance,
    deduct_from_wallet,
    log_api_usage,
    get_wallet_balance,
    DEMO_MODE
)
from decimal import Decimal

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

DEFAULT_PROFILE_SLUGS = {"default", "cost-optimized", "performance-first"}


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
        if message.get("message_group_id"):
            msg["message_group_id"] = message["message_group_id"]
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


def _normalize_limit(val):
    try:
        if val is None:
            return None
        return float(val)
    except Exception:
        return None


def update_routing_profile(slug: str, user_id: str, updates: dict) -> Optional[dict]:
    """Update a routing profile owned by the user and return the updated row."""
    result = (
        supabase.table("routing_profiles")
        .update(updates)
        .eq("slug", slug)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def delete_routing_profile(slug: str, user_id: str) -> bool:
    """Delete a routing profile owned by the user and return True if deleted."""
    result = (
        supabase.table("routing_profiles")
        .delete()
        .eq("slug", slug)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(result.data)


def _aggregate_message_totals(messages: list) -> dict:
    """Sum token and cost metadata for a set of assistant messages."""
    totals = {
        "tokens_routed": 0,
        "tokens_generated": 0,
        "spend": 0.0,
        "message_count": 0
    }
    for msg in messages:
        # Only count assistant responses which carry billing + token metadata
        if msg.get("role") and msg.get("role") != "assistant":
            continue
        metadata = msg.get("metadata") or {}
        totals["tokens_routed"] += metadata.get("input_tokens", 0) or 0
        totals["tokens_generated"] += metadata.get("output_tokens", 0) or 0
        totals["spend"] += metadata.get("cost", 0) or 0
        totals["message_count"] += 1
    return totals


async def get_profile_limits(profile_slug: str) -> dict:
    """Fetch hard limits from a profile's graph_state, if stored in Supabase."""

    def _load():
        return (
            supabase.table("routing_profiles")
            .select("graph_state, user_id, published")
            .eq("slug", profile_slug)
            .limit(1)
            .execute()
        )

    result = await asyncio.to_thread(_load)
    row = result.data[0] if result and result.data else None
    if not row:
        return {}

    graph_state = row.get("graph_state") or {}
    limits = graph_state.get("hardLimits") or graph_state.get("hard_limits") or {}

    # Backward compatibility for older keys
    max_output_tokens = limits.get("maxOutputTokens") or limits.get("max_output_tokens")
    max_cost = limits.get("maxCostPerCall") or limits.get("max_cost_per_call")

    return {
        "max_cost_per_call": _normalize_limit(max_cost),
        "max_output_tokens_per_call": _normalize_limit(max_output_tokens),
        "daily_spend_limit": _normalize_limit(limits.get("dailySpendLimit") or limits.get("daily_spend_limit")),
        "daily_output_tokens": _normalize_limit(limits.get("dailyOutputTokens") or limits.get("daily_output_tokens")),
        "owner_id": row.get("user_id"),
        "published": row.get("published"),
    }


async def _get_user_conversation_ids(user_id: str) -> List[str]:
    def _load():
        return supabase.table("conversations").select("id").eq("user_id", user_id).execute()

    result = await asyncio.to_thread(_load)
    return [row["id"] for row in (result.data or [])]


async def get_user_daily_usage(profile_slug: str, user_id: str) -> dict:
    """Return totals for the last 24h for this user and profile."""
    conversation_ids = await _get_user_conversation_ids(user_id)
    if not conversation_ids:
        return {"tokens_routed": 0, "tokens_generated": 0, "spend": 0.0, "message_count": 0}

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    def _load():
        return (
            supabase.table("messages")
            .select("metadata, role, created_at")
            .eq("profile_name", profile_slug)
            .in_("conversation_id", conversation_ids)
            .eq("role", "assistant")
            .gte("created_at", since)
            .execute()
        )

    result = await asyncio.to_thread(_load)
    return _aggregate_message_totals(result.data or [])


async def get_profile_usage(profile_slug: str, user_id: str) -> dict:
    """Compute per-user and global stats for a routing profile."""

    def _load_profile():
        # Use * so the call still works even if new columns are added later
        return (
            supabase.table("routing_profiles")
            .select("*")
            .eq("slug", profile_slug)
            .limit(1)
            .execute()
        )

    def _load_user_conversations():
        return (
            supabase.table("conversations")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )

    profile_row = await asyncio.to_thread(_load_profile)
    profile_data = profile_row.data[0] if profile_row.data else {}

    user_conversations = await asyncio.to_thread(_load_user_conversations)
    conversation_ids = [row["id"] for row in (user_conversations.data or [])]

    user_totals = {
        "tokens_routed": 0,
        "tokens_generated": 0,
        "spend": 0.0,
        "message_count": 0
    }

    if conversation_ids:
        def _load_user_messages():
            return (
                supabase.table("messages")
                .select("metadata, role")
                .eq("profile_name", profile_slug)
                .in_("conversation_id", conversation_ids)
                .eq("role", "assistant")
                .execute()
            )

        user_messages = await asyncio.to_thread(_load_user_messages)
        user_totals = _aggregate_message_totals(user_messages.data or [])

    published = bool(profile_data.get("published"))
    global_totals = None

    if published:
        def _load_global_messages():
            return (
                supabase.table("messages")
                .select("metadata, role")
                .eq("profile_name", profile_slug)
                .eq("role", "assistant")
                .execute()
            )

        global_messages = await asyncio.to_thread(_load_global_messages)
        global_totals = _aggregate_message_totals(global_messages.data or [])

    return {
        "profile": {
            "slug": profile_slug,
            "published": published,
            "owner_id": profile_data.get("user_id")
        },
        "stats": {
            "user": user_totals,
            "global": global_totals
        }
    }


async def enforce_usage_limits(profile_slug: str, user_id: str, usage: dict):
    """Raise HTTPException if the request would exceed any hard limits."""
    limits = await get_profile_limits(profile_slug)
    if not limits:
        return  # No stored limits or profile not found

    # Per-call checks
    if limits.get("max_cost_per_call") is not None and usage.get("cost", 0) > limits["max_cost_per_call"]:
        raise HTTPException(status_code=400, detail="Cost per call exceeds profile limit")

    if limits.get("max_output_tokens_per_call") is not None and usage.get("output_tokens", 0) > limits["max_output_tokens_per_call"]:
        raise HTTPException(status_code=400, detail="Output tokens per call exceed profile limit")

    # Daily checks (user scoped)
    if limits.get("daily_spend_limit") is None and limits.get("daily_output_tokens") is None:
        return

    daily_usage = await get_user_daily_usage(profile_slug, user_id)

    if limits.get("daily_spend_limit") is not None:
        if daily_usage.get("spend", 0) + usage.get("cost", 0) > limits["daily_spend_limit"]:
            raise HTTPException(status_code=400, detail="Daily spend limit exceeded for this profile")

    if limits.get("daily_output_tokens") is not None:
        if daily_usage.get("tokens_generated", 0) + usage.get("output_tokens", 0) > limits["daily_output_tokens"]:
            raise HTTPException(status_code=400, detail="Daily output token limit exceeded for this profile")


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

# Include OpenAI-compatible API router
from backend_code.API.router import router as api_router
app.include_router(api_router)

DEFAULT_USER_ID = "6785c292-273b-4001-9c1f-a6ff9e63979e"

# CORS configuration
# Using specific origins is required when allow_credentials=True
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://restruct-two.vercel.app",
        "https://restruct-two.vercel.app/",
        "https://restruct-4oeq.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Handle Supabase auth errors and return them as proper HTTP responses
@app.exception_handler(AuthApiError)
async def auth_error_handler(request, exc: AuthApiError):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    from starlette.exceptions import HTTPException as StarletteHTTPException
    
    status_code = 500
    detail = "Internal Server Error"
    
    if isinstance(exc, StarletteHTTPException):
        status_code = exc.status_code
        detail = exc.detail
    else:
        print(f"Global error: {exc}")
        detail = f"Internal Server Error: {str(exc)}"
        
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin") or "*",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )


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


async def check_demo_rate_limit(user_id: str):
    """Enforce strict rate limits for demo mode."""
    if not DEMO_MODE:
        return

    # Limit: 20 requests per day per user
    LIMIT = 20
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()

    try:
        def _count():
            return (
                supabase.table("api_usage")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .gte("created_at", since)
                .execute()
            )

        result = await asyncio.to_thread(_count)
        count = result.count if result.count is not None else len(result.data)

        if count >= LIMIT:
            raise HTTPException(
                status_code=429, 
                detail=f"Demo limit exceeded. You have used {count}/{LIMIT} requests in the last 24 hours."
            )
    except HTTPException:
        # Re-raise actual rate limits
        raise
    except Exception as e:
        # Fail open if DB check fails
        print(f"Warning: Demo rate limit check failed: {e}")
        pass


@app.get("/")
def root():
    """Health check."""
    return {
        "status": "online",
        "service": "Restruct Model Router",
        "version": "0.1.0",
        "code_version": "2024-12-13-community-profiles"
    }


@app.post("/chat")
async def chat(body: dict, authorization: str = Header(None)):
    """Main chat endpoint."""
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

    # Enforce demo limits
    await check_demo_rate_limit(user_id)

    # Add user message to conversation
    # Add user message to conversation (Optional - Fail open)
    try:
        await add_message(
            conversation_id=conversation_id,
            role="user",
            content=prompt
        )
    except Exception as e:
        print(f"Warning: Failed to save user message: {e}")

    try:
        conversation = await get_conversation_messages(conversation_id)
    except Exception as e:
        print(f"Warning: Failed to retrieve conversation: {e}")
        # Fallback to just current prompt if history unavailable
        conversation = [{"role": "user", "content": prompt}]

    # PHASE 1: ROUTING
    routing_start = time.time()
    model_choice = await resolve_model_choice(router_mode, model_override, conversation, profile_slug=profile, supabase_client=supabase)
    routing_time = time.time() - routing_start

    # WALLET CHECK: Estimate cost and check balance
    estimated_input_tokens = sum(len(msg["content"]) // 4 for msg in conversation)
    estimated_output_tokens = 500

    estimated_cost = calculate_cost(
        model_choice["vendor"],
        model_choice["model_name"],
        estimated_input_tokens,
        estimated_output_tokens
    )

    try:
        has_balance = await check_sufficient_balance(supabase, user_id, estimated_cost)
        if not has_balance:
            current_balance = await get_wallet_balance(supabase, user_id)
            # In fail-open mode, even if check fails, we might just log and proceed
            # But here we explicitly raise 402 if balance is definitely insufficient
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient balance. Current balance: ${float(current_balance):.4f}, Estimated cost: ${float(estimated_cost):.4f}"
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Warning: Wallet balance check failed: {e}")
        # Fail open: Allow request if wallet check errors out
        pass

    # PHASE 2: INFERENCE
    inference_start = time.time()
    response_data = await inference.inference(model_choice, conversation)
    inference_time = time.time() - inference_start

    response_text = response_data.get("text") or ""
    if not response_text:
        raise HTTPException(status_code=500, detail="Model returned empty response")

    input_tokens = response_data.get("input_tokens") or 0
    output_tokens = response_data.get("output_tokens") or 0

    # Calculate actual cost using wallet pricing
    actual_cost = calculate_cost(
        model_choice["vendor"],
        model_choice["model_name"],
        input_tokens,
        output_tokens
    )

    # Legacy cost calculation for metadata (keep for backward compatibility)
    input_cost_per_token = model_choice["config"].get("input_token_cost", 0.0)
    output_cost_per_token = model_choice["config"].get("output_token_cost", 0.0)
    total_cost = (input_tokens * input_cost_per_token) + (output_tokens * output_cost_per_token)

    # Deduct from wallet
    try:
        await deduct_from_wallet(supabase, user_id, actual_cost)
    except Exception as e:
        print(f"Warning: Wallet deduction failed: {e}")

    # Log API usage
    try:
        await log_api_usage(
            supabase,
            user_id,
            None,  # No API key for web app
            "/chat",
            "POST",
            model_choice["vendor"],
            model_choice["model_name"],
            profile,
            input_tokens,
            output_tokens,
            actual_cost,
            200,
            None,
            int((inference_time + routing_time) * 1000)
        )
    except Exception as e:
        print(f"Warning: API usage logging failed: {e}")

    try:
        await enforce_usage_limits(profile, user_id, {
            "cost": total_cost,
            "output_tokens": output_tokens
        })
    except Exception as e:
        print(f"Warning: Usage limit enforcement failed: {e}")

    # Save assistant message to database with full stats
    try:
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
    except Exception as e:
        print(f"Warning: Failed to save assistant message: {e}")

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
    """Batch endpoint for parallel multi-model responses with SSE streaming."""
    import time

    prompt = body.get("prompt")
    model_overrides = body.get("model_overrides")
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

    # Enforce demo limits
    await check_demo_rate_limit(user_id)

    # Save user message once
    await add_message(
        conversation_id=conversation_id,
        role="user",
        content=prompt
    )
    conversation = await get_conversation_messages(conversation_id)

    # Generate a unique message group ID for this batch
    message_group_id = str(uuid4())

    async def event_generator():
        # Send initial metadata event
        yield f"data: {json.dumps({'type': 'metadata', 'message_group_id': message_group_id, 'conversation_id': conversation_id})}\n\n"

        # Queue to collect results as they complete
        result_queue = asyncio.Queue()
        completed_count = 0
        total_models = len(model_overrides)

        async def process_model(model_override: str, index: int):
            try:
                # PHASE 1: ROUTING
                routing_start = time.time()
                model_choice = await resolve_model_choice("manual", model_override, conversation, profile_slug=profile, supabase_client=supabase)
                routing_time = time.time() - routing_start

                # WALLET CHECK: Estimate cost and check balance
                estimated_input_tokens = sum(len(msg["content"]) // 4 for msg in conversation)
                estimated_output_tokens = 500

                estimated_cost = calculate_cost(
                    model_choice["vendor"],
                    model_choice["model_name"],
                    estimated_input_tokens,
                    estimated_output_tokens
                )

                has_balance = await check_sufficient_balance(supabase, user_id, estimated_cost)
                if not has_balance:
                    current_balance = await get_wallet_balance(supabase, user_id)
                    result = {
                        "type": "error",
                        "index": index,
                        "model_override": model_override,
                        "error": f"Insufficient balance. Current: ${float(current_balance):.4f}, Need: ${float(estimated_cost):.4f}"
                    }
                    await result_queue.put(result)
                    return

                # PHASE 2: INFERENCE
                inference_start = time.time()
                response_data = await inference.inference(model_choice, conversation)
                inference_time = time.time() - inference_start

                response_text = response_data.get("text") or ""
                if not response_text:
                    result = {
                        "type": "error",
                        "index": index,
                        "model_override": model_override,
                        "error": "Model returned empty response"
                    }
                    await result_queue.put(result)
                    return

                input_tokens = response_data.get("input_tokens") or 0
                output_tokens = response_data.get("output_tokens") or 0

                # Calculate actual cost using wallet pricing
                actual_cost = calculate_cost(
                    model_choice["vendor"],
                    model_choice["model_name"],
                    input_tokens,
                    output_tokens
                )

                # Legacy cost calculation for metadata
                input_cost_per_token = model_choice["config"].get("input_token_cost", 0.0)
                output_cost_per_token = model_choice["config"].get("output_token_cost", 0.0)
                total_cost = (input_tokens * input_cost_per_token) + (output_tokens * output_cost_per_token)

                # Deduct from wallet
                await deduct_from_wallet(supabase, user_id, actual_cost)

                # Log API usage
                await log_api_usage(
                    supabase,
                    user_id,
                    None,  # No API key for web app
                    "/chat/batch",
                    "POST",
                    model_choice["vendor"],
                    model_choice["model_name"],
                    profile,
                    input_tokens,
                    output_tokens,
                    actual_cost,
                    200,
                    None,
                    int((inference_time + routing_time) * 1000)
                )

                await enforce_usage_limits(profile, user_id, {
                    "cost": total_cost,
                    "output_tokens": output_tokens
                })

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

                result = {
                    "type": "result",
                    "index": index,
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
                await result_queue.put(result)

            except Exception as e:
                result = {
                    "type": "error",
                    "index": index,
                    "model_override": model_override,
                    "error": str(e)
                }
                await result_queue.put(result)

        # Start all model tasks in parallel
        tasks = [asyncio.create_task(process_model(override, idx)) for idx, override in enumerate(model_overrides)]

        # Stream results as they complete
        while completed_count < total_models:
            result = await result_queue.get()
            yield f"data: {json.dumps(result)}\n\n"
            completed_count += 1

        # Wait for all tasks to complete (should already be done)
        await asyncio.gather(*tasks)

        # Send completion event
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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

    messages = await get_conversation_messages(conversation_id)
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


@app.get("/profiles/community")
async def get_community_profiles(
    search: Optional[str] = None,
    tags: Optional[str] = None,
    sort: str = "popular"
):
    """List all published community profiles with filtering and sorting."""
    tag_list = tags.split(",") if tags else None
    community_profiles = profiles.get_community_profiles(supabase, search, tag_list, sort)
    return {"profiles": community_profiles}


@app.get("/profiles/{profile_slug}/stats")
async def profile_stats(profile_slug: str, authorization: str = Header(None)):
    """Return per-user and global usage for a routing profile."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    usage = await get_profile_usage(profile_slug, user.id)
    return usage


@app.patch("/profiles/{profile_slug}")
async def update_profile(profile_slug: str, body: dict, authorization: str = Header(None)):
    """Update a routing profile (currently used for publish/unpublish)."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if profile_slug in DEFAULT_PROFILE_SLUGS:
        raise HTTPException(status_code=403, detail="Default profiles cannot be modified")

    allowed_fields = {"published", "graph_state", "description", "name", "icon"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    updated = update_routing_profile(profile_slug, user.id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Profile not found or not owned by user")

    return {"profile": updated}


@app.delete("/profiles/{profile_slug}")
async def delete_profile(profile_slug: str, authorization: str = Header(None)):
    """Delete a routing profile owned by the user."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if profile_slug in DEFAULT_PROFILE_SLUGS:
        raise HTTPException(status_code=403, detail="Default profiles cannot be deleted")

    deleted = delete_routing_profile(profile_slug, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile not found or not owned by user")

    return {"success": True, "slug": profile_slug}


@app.post("/profiles/test-route")
async def test_route_profile(body: dict, authorization: str = Header(None)):
    """
    Test routing with a prompt and graph_state without actually calling the model.
    Returns the model that would be selected based on the profile settings.
    """
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    prompt = body.get("prompt")
    graph_state = body.get("graph_state")

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    if not isinstance(graph_state, dict):
        raise HTTPException(status_code=400, detail="Graph state is required")

    conversation = [{"role": "user", "content": prompt}]

    normalized_graph = profiles.normalize_graph_state(graph_state)
    allowed_providers = [p.get("id") for p in (normalized_graph.get("providers") or []) if p.get("enabled", True)]
    rules_text = profiles._rules_to_text(normalized_graph.get("rules") or [])

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not set for routing")

    router_model = {
        "vendor": "google",
        "model_name": "gemini-2.0-flash-lite",
        "api_key": api_key,
    }

    prompt_text = router._conversation_to_prompt(conversation)
    system_prompt = f"""Rate this prompt with scores 0-10 (integers). Use these exact keys: overall_complexity, mathematical_and_logical_reasoning, linguistic_and_creative_reasoning, factuality, chain_of_thought_depth. Return ONLY valid JSON.

Routing rules:
{rules_text}

Prompt: {prompt_text}

JSON:"""

    payload = []
    payload.extend(conversation)
    payload.append({"role": "user", "content": system_prompt})

    response = await inference.call_google(router_model, payload)
    response_text = response["text"]
    match = re.search(r"\{[^}]+\}", response_text, re.DOTALL)
    if not match:
        raise HTTPException(status_code=500, detail="Failed to get routing scores")

    normalized_scores = json.loads(match.group())

    best_model = None
    best_distance = float("inf")
    all_models = []

    for vendor, vendor_data in router.MODELS.items():
        if allowed_providers and vendor not in allowed_providers:
            continue
        for model_name, model_cfg in vendor_data["models"].items():
            attrs = model_cfg.get("capability_attributes", {})
            distance = router.calculate_model_score(normalized_scores, attrs)
            model_info = {
                "vendor": vendor,
                "model_name": model_name,
                "distance": distance,
                "display_name": model_cfg.get("display_name", model_name)
            }
            all_models.append(model_info)

            if distance < best_distance:
                best_distance = distance
                best_model = {
                    "vendor": vendor,
                    "model_name": model_name,
                    "display_name": model_cfg.get("display_name", model_name),
                    "distance": distance,
                    "scores": normalized_scores
                }

    all_models.sort(key=lambda m: m["distance"])

    return {
        "selected_model": best_model,
        "all_models": all_models[:5],
        "scores": normalized_scores
    }


# ============================================
# COMMUNITY PROFILE ENDPOINTS
# ============================================

@app.get("/tags")
async def list_tags():
    """List all available tags (predefined + custom)."""
    tags = profiles.list_all_tags(supabase)
    return {"tags": tags}


@app.post("/tags")
async def create_tag(body: dict, authorization: str = Header(None)):
    """Create a custom tag."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    name = body.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Tag name is required")

    category = body.get("category", "custom")
    tag = profiles.create_tag(supabase, name, category, user.id)
    return {"tag": tag}


@app.post("/profiles/{profile_slug}/rate")
async def rate_profile(profile_slug: str, body: dict, authorization: str = Header(None)):
    """Rate a profile (1-5 stars)."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    rating = body.get("rating")
    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be an integer between 1 and 5")

    profile = profiles.get_profile_by_slug(supabase, profile_slug)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    result = profiles.rate_profile(supabase, profile["id"], user.id, rating)
    return {"success": True, **result}


@app.get("/profiles/{profile_slug}/ratings")
async def get_profile_ratings(profile_slug: str, authorization: str = Header(None)):
    """Get rating breakdown for a profile."""
    user = await get_user_from_token(authorization) if authorization else None
    user_id = user.id if user else None

    profile = profiles.get_profile_by_slug(supabase, profile_slug)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    breakdown = profiles.get_profile_ratings_breakdown(supabase, profile["id"], user_id)
    return breakdown


@app.post("/profiles/{profile_slug}/download")
async def download_profile(profile_slug: str, authorization: str = Header(None)):
    """Track profile download/import."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    profile = profiles.get_profile_by_slug(supabase, profile_slug)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profiles.track_profile_download(supabase, profile["id"], user.id)

    return {"success": True, "profile": profile}


@app.get("/profiles/{profile_slug}/analytics")
async def get_profile_analytics(profile_slug: str, authorization: str = Header(None)):
    """Get analytics for a profile owner."""
    user = await get_user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    profile = profiles.get_profile_by_slug(supabase, profile_slug)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Only allow profile owner to view analytics
    if profile["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="You can only view analytics for your own profiles")

    analytics = profiles.get_profile_analytics(supabase, profile["id"], user.id)
    return analytics


async def resolve_model_choice(router_mode: str, model_override: Optional[str], conversation, profile_slug: Optional[str] = None, supabase_client: Optional[Client] = None):
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
    # If a profile slug is provided, try the profile-aware router first.
    if profile_slug:
        try:
            model = await profiles.route_with_profile(supabase_client or supabase, conversation, profile_slug)
            if model:
                return model
        except Exception as e:
            print(f"[profile-router] fallback to legacy routing due to: {e}")

    try:
        model, model_scores = await router.route_with_llm(conversation)
        return model
    except Exception as e:
        print(f"[router] fallback to default routing due to: {e}")
        # Ultimate fallback to GPT-5 if routing completely fails
        return router.route_specific("openai", "gpt-5")


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
