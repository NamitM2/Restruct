"""
FastAPI router for OpenAI-compatible API endpoints.
"""

from fastapi import APIRouter, HTTPException, Header, Depends, Query
from fastapi.responses import JSONResponse, StreamingResponse
import asyncio
import time
import uuid
from typing import Optional

from .schemas import ChatCompletionRequest, ChatCompletionResponse
from .openai_compat import create_completion_response, parse_model_parameter
from .api_keys import validate_api_key
from .wallet import (
    calculate_cost,
    check_sufficient_balance,
    deduct_from_wallet,
    log_api_usage,
    get_wallet_balance
)
from .rate_limiter import check_rate_limit
from decimal import Decimal

# Import existing backend logic
import backend_code.router as restruct_router
import backend_code.profiles as profiles
import backend_code.inference as inference


router = APIRouter(prefix="/v1", tags=["OpenAI Compatible API"])


async def authenticate_request(authorization: str):
    """
    Authenticate request using either JWT token or API key.

    Returns:
        User dict if authenticated, raises HTTPException if not
    """
    from backend_code.app import get_user_from_token, supabase

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing authorization token")

    token = authorization.split(" ", 1)[1]

    # Check if it's an API key (starts with "rst_")
    if token.startswith("rst_"):
        user = await validate_api_key(supabase, token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return user

    # Otherwise, treat as JWT token
    user_obj = await get_user_from_token(authorization)
    if not user_obj:
        raise HTTPException(status_code=401, detail="Invalid or missing authorization token")

    # Normalize to dict format (get_user_from_token returns a User object)
    return {
        "id": user_obj.id,
        "email": user_obj.email if hasattr(user_obj, 'email') else None
    }


@router.post("/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(
    request: ChatCompletionRequest,
    authorization: str = Header(None)
):
    """
    OpenAI-compatible chat completions endpoint.

    Supports:
    - Auto routing with profiles
    - Manual model selection
    - Stateless operation (no conversation storage)
    - Full token usage tracking

    Example:
        POST /v1/chat/completions
        Authorization: Bearer <jwt_token>

        {
            "model": "auto",
            "messages": [{"role": "user", "content": "Hello!"}],
            "restruct": {"profile": "cost-optimized"}
        }
    """

    # ========================================================================
    # 1. AUTHENTICATION
    # ========================================================================

    # Import here to avoid circular import
    from backend_code.app import supabase

    user = await authenticate_request(authorization)

    # ========================================================================
    # 2. VALIDATE REQUEST
    # ========================================================================

    if not request.messages:
        raise HTTPException(
            status_code=400,
            detail="Messages array cannot be empty"
        )

    # Convert messages to internal format
    conversation = [
        {"role": msg.role, "content": msg.content}
        for msg in request.messages
    ]

    # ========================================================================
    # 3. MODEL ROUTING
    # ========================================================================

    routing_start = time.time()

    # Parse model parameter
    provider, model_name = parse_model_parameter(request.model)

    # Get profile slug if provided
    profile_slug = request.restruct.profile if request.restruct else None

    try:
        if provider and model_name:
            # Manual model selection
            model_choice = restruct_router.route_specific(provider, model_name)
        elif profile_slug:
            # Profile-based routing
            model_choice = await profiles.route_with_profile(
                supabase,
                conversation,
                profile_slug
            )
            if not model_choice:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile '{profile_slug}' not found or has no enabled providers"
                )
        else:
            # Auto routing (no profile)
            model_choice, llm_scores = await restruct_router.route_with_llm(conversation)

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Routing error: {type(e).__name__}: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Routing failed: {type(e).__name__}: {str(e)}"
        )

    routing_time = (time.time() - routing_start) * 1000  # ms

    # ========================================================================
    # 4. RATE LIMITING (if using profile)
    # ========================================================================

    if profile_slug:
        # Get profile's rate limit settings
        profile_result = supabase.table("routing_profiles").select(
            "rate_limit_rpm, rate_limit_rph, rate_limit_rpd"
        ).eq("slug", profile_slug).execute()

        if profile_result.data:
            profile_data = profile_result.data[0]
            rate_allowed, rate_error = await check_rate_limit(
                supabase,
                user["id"],
                profile_slug,
                profile_data.get("rate_limit_rpm"),
                profile_data.get("rate_limit_rph"),
                profile_data.get("rate_limit_rpd")
            )

            if not rate_allowed:
                raise HTTPException(status_code=429, detail=rate_error)

    # ========================================================================
    # 5. WALLET BALANCE CHECK
    # ========================================================================

    # Estimate cost (rough approximation - will deduct actual cost after inference)
    estimated_input_tokens = sum(len(msg["content"]) // 4 for msg in conversation)
    estimated_output_tokens = 500  # Conservative estimate

    estimated_cost = calculate_cost(
        model_choice["vendor"],
        model_choice["model_name"],
        estimated_input_tokens,
        estimated_output_tokens
    )

    # Check if user has sufficient balance
    has_balance = await check_sufficient_balance(supabase, user["id"], estimated_cost)
    if not has_balance:
        current_balance = await get_wallet_balance(supabase, user["id"])
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient balance. Current balance: ${float(current_balance):.4f}, Estimated cost: ${float(estimated_cost):.4f}"
        )

    # ========================================================================
    # 6. STREAMING vs NON-STREAMING
    # ========================================================================

    if request.stream:
        # Streaming response
        from .openai_compat import create_streaming_chunk, create_streaming_done

        async def stream_generator():
            chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
            total_input_tokens = 0
            total_output_tokens = 0
            request_start = time.time()

            try:
                async for chunk in inference.inference_stream(model_choice, conversation):
                    if chunk.get("done"):
                        # Get actual token usage
                        usage = chunk.get("usage", {})
                        total_input_tokens = usage.get("input_tokens", 0)
                        total_output_tokens = usage.get("output_tokens", 0)

                        # Calculate actual cost
                        actual_cost = calculate_cost(
                            model_choice["vendor"],
                            model_choice["model_name"],
                            total_input_tokens,
                            total_output_tokens
                        )

                        # Deduct from wallet
                        await deduct_from_wallet(supabase, user["id"], actual_cost)

                        # Log usage
                        request_duration = int((time.time() - request_start) * 1000)
                        await log_api_usage(
                            supabase,
                            user["id"],
                            user.get("api_key_id"),
                            "/v1/chat/completions",
                            "POST",
                            model_choice["vendor"],
                            model_choice["model_name"],
                            profile_slug,
                            total_input_tokens,
                            total_output_tokens,
                            actual_cost,
                            200,
                            None,
                            request_duration
                        )

                        # Final chunk with usage
                        sse_chunk = create_streaming_chunk(
                            chunk_id=chunk_id,
                            model_name=model_choice["model_name"],
                            delta_content="",
                            done=True,
                            finish_reason="stop",
                            usage=usage
                        )
                        yield sse_chunk
                    else:
                        # Delta chunk
                        sse_chunk = create_streaming_chunk(
                            chunk_id=chunk_id,
                            model_name=model_choice["model_name"],
                            delta_content=chunk.get("delta", ""),
                            done=False
                        )
                        yield sse_chunk

                # Send [DONE] message
                yield create_streaming_done()

            except Exception as e:
                # Log error
                request_duration = int((time.time() - request_start) * 1000)
                await log_api_usage(
                    supabase,
                    user["id"],
                    user.get("api_key_id"),
                    "/v1/chat/completions",
                    "POST",
                    model_choice["vendor"],
                    model_choice["model_name"],
                    profile_slug,
                    0,
                    0,
                    Decimal("0"),
                    500,
                    str(e),
                    request_duration
                )

                # Send error as SSE comment
                yield f": Error - {str(e)}\n\n"
                yield create_streaming_done()

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream"
        )

    # ========================================================================
    # 7. NON-STREAMING INFERENCE
    # ========================================================================

    inference_start = time.time()

    try:
        result = await inference.inference(model_choice, conversation)
        response_text = result["text"]
        input_tokens = result["input_tokens"]
        output_tokens = result["output_tokens"]

    except Exception as e:
        # Log error
        request_duration = int((time.time() - inference_start) * 1000)
        await log_api_usage(
            supabase,
            user["id"],
            user.get("api_key_id"),
            "/v1/chat/completions",
            "POST",
            model_choice["vendor"],
            model_choice["model_name"],
            profile_slug,
            0,
            0,
            Decimal("0"),
            500,
            str(e),
            request_duration
        )

        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {str(e)}"
        )

    inference_time = (time.time() - inference_start) * 1000  # ms

    # ========================================================================
    # 8. COST DEDUCTION AND LOGGING
    # ========================================================================

    # Calculate actual cost
    actual_cost = calculate_cost(
        model_choice["vendor"],
        model_choice["model_name"],
        input_tokens,
        output_tokens
    )

    # Deduct from wallet
    await deduct_from_wallet(supabase, user["id"], actual_cost)

    # Log usage
    await log_api_usage(
        supabase,
        user["id"],
        user.get("api_key_id"),
        "/v1/chat/completions",
        "POST",
        model_choice["vendor"],
        model_choice["model_name"],
        profile_slug,
        input_tokens,
        output_tokens,
        actual_cost,
        200,
        None,
        int(inference_time)
    )

    # ========================================================================
    # 9. FORMAT RESPONSE
    # ========================================================================

    response = create_completion_response(
        model_name=model_choice["model_name"],
        provider=model_choice["vendor"],
        response_text=response_text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        routing_metadata={
            "score": model_choice.get("score"),
            "routing_time_ms": round(routing_time, 2),
            "inference_time_ms": round(inference_time, 2)
        },
        profile_used=profile_slug
    )

    return response


@router.get("/models")
async def list_models():
    """
    List available models (OpenAI-compatible endpoint).

    Returns models from all providers in OpenAI format.
    """
    from backend_code.models_config import MODELS

    models = []
    for provider, config in MODELS.items():
        for model_name in config["models"].keys():
            models.append({
                "id": f"{provider}:{model_name}",
                "object": "model",
                "owned_by": provider,
                "permission": []
            })

    return {
        "object": "list",
        "data": models
    }


@router.post("/keys")
async def create_key(
    authorization: str = Header(None),
    name: Optional[str] = Query(None),
    expires_at: Optional[str] = Query(None)
):
    """
    Create a new API key.

    Args:
        name: Optional name for the key
        expires_at: Optional expiration timestamp in ISO format (e.g., "2024-12-31T23:59:59Z")

    The key is only shown once - save it securely.
    """
    from backend_code.app import supabase
    from .api_keys import create_api_key

    user = await authenticate_request(authorization)

    result = await create_api_key(supabase, user["id"], name, expires_at)

    return {
        "id": result["id"],
        "key": result["key"],
        "key_prefix": result["key_prefix"],
        "name": result["name"],
        "expires_at": result.get("expires_at"),
        "created_at": result["created_at"],
        "warning": "Save this key securely - it will not be shown again"
    }


@router.get("/keys")
async def list_keys(authorization: str = Header(None)):
    """
    List all API keys for the authenticated user.

    Does not return the actual keys, only metadata.
    """
    from backend_code.app import supabase
    from .api_keys import list_api_keys

    user = await authenticate_request(authorization)

    keys = await list_api_keys(supabase, user["id"])

    return {
        "object": "list",
        "data": keys
    }


@router.patch("/keys/{key_id}")
async def update_key(
    key_id: str,
    authorization: str = Header(None),
    name: Optional[str] = Query(None)
):
    """
    Update an API key's name.
    """
    from backend_code.app import supabase
    from .api_keys_update import update_api_key

    user = await authenticate_request(authorization)

    success = await update_api_key(supabase, user["id"], key_id, name)

    if not success:
        raise HTTPException(status_code=404, detail="API key not found")

    return {"updated": True, "id": key_id, "name": name}


@router.delete("/keys/{key_id}")
async def delete_key(key_id: str, authorization: str = Header(None)):
    """
    Delete an API key permanently.
    """
    from backend_code.app import supabase
    from .api_keys import delete_api_key

    user = await authenticate_request(authorization)

    success = await delete_api_key(supabase, user["id"], key_id)

    if not success:
        raise HTTPException(status_code=404, detail="API key not found")

    return {"deleted": True, "id": key_id}


@router.get("/wallet")
async def get_wallet(authorization: str = Header(None)):
    """
    Get wallet balance for authenticated user.
    """
    from backend_code.app import supabase

    user = await authenticate_request(authorization)

    balance = await get_wallet_balance(supabase, user["id"])

    return {
        "balance": float(balance),
        "currency": "USD"
    }


@router.post("/wallet/add-funds")
async def add_wallet_funds(
    amount: float,
    authorization: str = Header(None)
):
    """
    Add funds to wallet.

    NOTE: This endpoint does NOT process actual payments yet.
    It's for testing/admin purposes only.
    """
    from backend_code.app import supabase
    from .wallet import add_funds

    user = await authenticate_request(authorization)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    result = await add_funds(supabase, user["id"], Decimal(str(amount)))

    return {
        "balance": result["balance"],
        "added": result["added"],
        "currency": "USD",
        "warning": "This endpoint does not process real payments yet"
    }


@router.get("/usage")
async def get_usage(
    limit: int = Query(default=100, le=1000),
    authorization: str = Header(None)
):
    """
    Get API usage history for authenticated user.
    """
    from backend_code.app import supabase

    user = await authenticate_request(authorization)

    result = supabase.table("api_usage").select("*").eq(
        "user_id", user["id"]
    ).order("created_at", desc=True).limit(limit).execute()

    return {
        "object": "list",
        "data": result.data
    }


@router.get("/statistics/dashboard")
async def get_statistics_dashboard(authorization: str = Header(None)):
    """
    Get comprehensive dashboard metrics (daily, weekly, monthly, yearly).
    """
    from backend_code.app import supabase
    from .statistics import get_dashboard_metrics

    user = await authenticate_request(authorization)
    metrics = await get_dashboard_metrics(supabase, user["id"])

    return {
        "object": "dashboard_metrics",
        "data": metrics
    }


@router.get("/statistics/models")
async def get_statistics_models(
    profile: Optional[str] = Query(default=None),
    authorization: str = Header(None)
):
    """
    Get usage breakdown by model.
    Query params:
        - profile: Filter by profile name (optional, default = all profiles)
    """
    from backend_code.app import supabase
    from .statistics import get_model_breakdown

    user = await authenticate_request(authorization)
    breakdown = await get_model_breakdown(supabase, user["id"], profile)

    return {
        "object": "model_breakdown",
        "data": breakdown
    }


@router.get("/statistics/profiles")
async def get_statistics_profiles(authorization: str = Header(None)):
    """
    Get usage breakdown by profile.
    """
    from backend_code.app import supabase
    from .statistics import get_profile_breakdown

    user = await authenticate_request(authorization)
    breakdown = await get_profile_breakdown(supabase, user["id"])

    return {
        "object": "profile_breakdown",
        "data": breakdown
    }


@router.get("/statistics/timeline")
async def get_statistics_timeline(
    days: int = Query(default=30, le=365),
    authorization: str = Header(None)
):
    """
    Get daily usage timeline for charting.
    Query params:
        - days: Number of days to include (default 30, max 365)
    """
    from backend_code.app import supabase
    from .statistics import get_usage_timeline

    user = await authenticate_request(authorization)
    timeline = await get_usage_timeline(supabase, user["id"], days)

    return {
        "object": "usage_timeline",
        "data": timeline
    }
