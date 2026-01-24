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
    # 2. SHARED CONVERSATION SECURITY CHECKS
    # ========================================================================

    conversation_id = request.restruct.conversation_id if request.restruct else None
    participant_info = None
    billing_user_id = user["id"]  # Default to requesting user

    if conversation_id:
        from .shared_conversation_rate_limiter import (
            get_participant_info,
            check_participant_rate_limit,
            check_conversation_rate_limit
        )
        from .shared_conversation_billing import (
            determine_billing_user,
            validate_participant_can_pay
        )

        # Get participant information
        participant_info = await get_participant_info(supabase, conversation_id, user["id"])

        if not participant_info:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this conversation"
            )

        # Check if participant is active
        if not participant_info["is_active"]:
            raise HTTPException(
                status_code=403,
                detail="Your access to this conversation has been suspended"
            )

        # Check if blocked for abuse
        if participant_info.get("blocked_for_abuse"):
            raise HTTPException(
                status_code=403,
                detail="You have been blocked from this conversation due to abusive behavior"
            )

        # Check if participant access has expired
        if participant_info.get("access_expired"):
            expires_at = participant_info.get("access_expires_at")
            raise HTTPException(
                status_code=403,
                detail=f"Your chat access to this conversation has expired. Access ended at: {expires_at}"
            )

        # View-only participants cannot send messages
        if participant_info["permission"] == "view":
            raise HTTPException(
                status_code=403,
                detail="You have view-only access to this conversation. Upgrade to 'chat' permission to send messages."
            )

        # Check participant rate limits
        is_allowed, rate_error = await check_participant_rate_limit(
            supabase,
            conversation_id,
            user["id"],
            participant_info["is_owner"]
        )

        if not is_allowed:
            raise HTTPException(status_code=429, detail=rate_error)

        # Check conversation-wide rate limits
        is_allowed, conv_rate_error = await check_conversation_rate_limit(
            supabase,
            conversation_id
        )

        if not is_allowed:
            raise HTTPException(status_code=429, detail=conv_rate_error)

        # Determine billing user
        billing_info = await determine_billing_user(supabase, conversation_id, user["id"])
        billing_user_id = billing_info["billing_user_id"]

        # For individual billing, verify participant has funds
        if billing_info["billing_mode"] == "individual" and not billing_info["is_owner"]:
            estimated_cost = Decimal("0.01")  # Rough estimate
            can_pay = await validate_participant_can_pay(supabase, user["id"], estimated_cost)

            if not can_pay:
                current_balance = await get_wallet_balance(supabase, user["id"])
                raise HTTPException(
                    status_code=402,
                    detail=f"Insufficient funds. This conversation uses individual billing. Current balance: ${float(current_balance):.4f}. Please add funds to continue."
                )

    # ========================================================================
    # 3. VALIDATE REQUEST
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
    # 4. RATE LIMITING
    # ========================================================================

    # Check per-key rate limits (if using API key)
    if user.get("api_key_id"):
        from .key_rate_limiter import check_key_rate_limit

        key_rate_allowed, key_rate_error = await check_key_rate_limit(
            supabase,
            user["api_key_id"],
            user.get("rate_limit_rpm"),
            user.get("rate_limit_rph"),
            user.get("rate_limit_rpd")
        )

        if not key_rate_allowed:
            raise HTTPException(status_code=429, detail=key_rate_error)

    # Check profile-based rate limits (if using profile)
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

    # Check if billing user has sufficient balance
    has_balance = await check_sufficient_balance(supabase, billing_user_id, estimated_cost)
    if not has_balance:
        current_balance = await get_wallet_balance(supabase, billing_user_id)
        if billing_user_id != user["id"]:
            # Owner is paying but has insufficient funds
            raise HTTPException(
                status_code=402,
                detail=f"Conversation owner has insufficient balance to process this message. Current balance: ${float(current_balance):.4f}, Estimated cost: ${float(estimated_cost):.4f}"
            )
        else:
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

                        # Deduct from wallet (billing user)
                        await deduct_from_wallet(supabase, billing_user_id, actual_cost)

                        # Log usage
                        request_duration = int((time.time() - request_start) * 1000)
                        await log_api_usage(
                            supabase,
                            billing_user_id,  # Billing user
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
                            request_duration,
                            conversation_id=conversation_id  # Track shared conversation
                        )

                        # Increment per-key rate limit counters
                        if user.get("api_key_id"):
                            from .key_rate_limiter import increment_key_rate_limit
                            await increment_key_rate_limit(supabase, user["api_key_id"])

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
                    billing_user_id,  # Billing user
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
                    request_duration,
                    conversation_id=conversation_id  # Track shared conversation
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
            billing_user_id,  # Billing user
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
            request_duration,
            conversation_id=conversation_id  # Track shared conversation
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

    # Deduct from wallet (billing user)
    await deduct_from_wallet(supabase, billing_user_id, actual_cost)

    # Log usage
    await log_api_usage(
        supabase,
        billing_user_id,  # Billing user
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
        int(inference_time),
        conversation_id=conversation_id  # Track shared conversation
    )

    # Increment per-key rate limit counters
    if user.get("api_key_id"):
        from .key_rate_limiter import increment_key_rate_limit
        await increment_key_rate_limit(supabase, user["api_key_id"])

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
    body: dict,
    authorization: str = Header(None)
):
    """
    Create a new API key with optional rate limits and metadata.

    Body params:
        name: Optional name for the key
        expires_at: Optional expiration timestamp (ISO format)
        rate_limit_rpm: Requests per minute limit
        rate_limit_rph: Requests per hour limit
        rate_limit_rpd: Requests per day limit
        environment: Environment tag (e.g., production, staging)
        application: Application name
        tags: Array of tags
        notes: Notes about this key

    The key is only shown once - save it securely.
    """
    from backend_code.app import supabase
    from .api_keys import create_api_key

    user = await authenticate_request(authorization)

    name = body.get("name")
    expires_at = body.get("expires_at")

    result = await create_api_key(supabase, user["id"], name, expires_at)

    # Update with additional metadata if provided
    update_fields = {}
    if body.get("rate_limit_rpm"):
        update_fields["rate_limit_rpm"] = body["rate_limit_rpm"]
    if body.get("rate_limit_rph"):
        update_fields["rate_limit_rph"] = body["rate_limit_rph"]
    if body.get("rate_limit_rpd"):
        update_fields["rate_limit_rpd"] = body["rate_limit_rpd"]
    if body.get("environment"):
        update_fields["environment"] = body["environment"]
    if body.get("application"):
        update_fields["application"] = body["application"]
    if body.get("tags"):
        update_fields["tags"] = body["tags"]
    if body.get("notes"):
        update_fields["notes"] = body["notes"]

    if update_fields:
        supabase.table("api_keys").update(update_fields).eq("id", result["id"]).execute()

    return {
        "id": result["id"],
        "key": result["key"],
        "key_prefix": result["key_prefix"],
        "name": result["name"],
        "expires_at": result.get("expires_at"),
        "created_at": result["created_at"],
        "rate_limits": {
            "rpm": update_fields.get("rate_limit_rpm"),
            "rph": update_fields.get("rate_limit_rph"),
            "rpd": update_fields.get("rate_limit_rpd")
        } if any(k.startswith("rate_limit") for k in update_fields) else None,
        "metadata": {
            "environment": update_fields.get("environment"),
            "application": update_fields.get("application"),
            "tags": update_fields.get("tags"),
            "notes": update_fields.get("notes")
        } if any(k in ["environment", "application", "tags", "notes"] for k in update_fields) else None,
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
    body: dict,
    authorization: str = Header(None)
):
    """
    Update an API key's metadata and rate limits.

    Body params:
        name: Key name
        rate_limit_rpm: Requests per minute limit
        rate_limit_rph: Requests per hour limit
        rate_limit_rpd: Requests per day limit
        environment: Environment tag
        application: Application name
        tags: Array of tags
        notes: Notes
    """
    from backend_code.app import supabase
    import asyncio

    user = await authenticate_request(authorization)

    # Verify key belongs to user
    def _verify():
        return supabase.table("api_keys").select("id").eq("id", key_id).eq("user_id", user["id"]).execute()

    result = await asyncio.to_thread(_verify)
    if not result.data:
        raise HTTPException(status_code=404, detail="API key not found")

    # Build update payload
    update_fields = {}
    if "name" in body:
        update_fields["name"] = body["name"]
    if "rate_limit_rpm" in body:
        update_fields["rate_limit_rpm"] = body["rate_limit_rpm"]
    if "rate_limit_rph" in body:
        update_fields["rate_limit_rph"] = body["rate_limit_rph"]
    if "rate_limit_rpd" in body:
        update_fields["rate_limit_rpd"] = body["rate_limit_rpd"]
    if "environment" in body:
        update_fields["environment"] = body["environment"]
    if "application" in body:
        update_fields["application"] = body["application"]
    if "tags" in body:
        update_fields["tags"] = body["tags"]
    if "notes" in body:
        update_fields["notes"] = body["notes"]

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Update key
    def _update():
        return supabase.table("api_keys").update(update_fields).eq("id", key_id).execute()

    await asyncio.to_thread(_update)

    return {"updated": True, "id": key_id, "fields": list(update_fields.keys())}


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


@router.get("/keys/{key_id}/usage")
async def get_key_usage(
    key_id: str,
    time_range: str = Query(default="7d"),
    authorization: str = Header(None)
):
    """
    Get usage statistics for a specific API key.

    Query params:
        - time_range: 24h, 7d, 30d, all (default: 7d)

    Returns comprehensive usage stats including:
        - Summary (requests, cost, tokens, success rate, latency)
        - Top models used
        - Top profiles used
        - Recent requests
    """
    from backend_code.app import supabase
    from .key_analytics import get_key_usage_stats

    user = await authenticate_request(authorization)
    stats = await get_key_usage_stats(supabase, user["id"], key_id, time_range)

    if stats is None:
        raise HTTPException(status_code=404, detail="API key not found")

    return {
        "object": "key_usage_stats",
        "data": stats
    }


@router.get("/keys/{key_id}/timeline")
async def get_key_timeline(
    key_id: str,
    days: int = Query(default=30, le=365),
    authorization: str = Header(None)
):
    """
    Get daily usage timeline for a specific API key.

    Query params:
        - days: Number of days to include (default 30, max 365)

    Returns daily aggregates for charting.
    """
    from backend_code.app import supabase
    from .key_analytics import get_key_usage_timeline

    user = await authenticate_request(authorization)
    timeline = await get_key_usage_timeline(supabase, user["id"], key_id, days)

    if timeline is None:
        raise HTTPException(status_code=404, detail="API key not found")

    return {
        "object": "key_timeline",
        "data": timeline
    }


@router.get("/keys/compare")
async def compare_keys(
    time_range: str = Query(default="7d"),
    authorization: str = Header(None)
):
    """
    Compare usage across all API keys.

    Query params:
        - time_range: 24h, 7d, 30d, all (default: 7d)

    Returns usage comparison sorted by cost.
    """
    from backend_code.app import supabase
    from .key_analytics import compare_keys_usage

    user = await authenticate_request(authorization)
    comparison = await compare_keys_usage(supabase, user["id"], time_range)

    return {
        "object": "keys_comparison",
        "data": comparison
    }


@router.get("/keys/{key_id}/rate-limits")
async def get_key_rate_limits(
    key_id: str,
    authorization: str = Header(None)
):
    """
    Get current rate limit status for an API key.

    Returns current usage vs limits for minute/hour/day windows.
    """
    from backend_code.app import supabase
    from .key_rate_limiter import get_key_rate_limit_status
    import asyncio

    user = await authenticate_request(authorization)

    # Get key's rate limit configuration
    def _get_limits():
        return supabase.table("api_keys").select(
            "rate_limit_rpm, rate_limit_rph, rate_limit_rpd"
        ).eq("id", key_id).eq("user_id", user["id"]).execute()

    result = await asyncio.to_thread(_get_limits)
    if not result.data:
        raise HTTPException(status_code=404, detail="API key not found")

    limits = result.data[0]
    status = await get_key_rate_limit_status(
        supabase,
        key_id,
        limits.get("rate_limit_rpm"),
        limits.get("rate_limit_rph"),
        limits.get("rate_limit_rpd")
    )

    return {
        "object": "rate_limit_status",
        "data": status
    }


@router.post("/conversations/{conversation_id}/share")
async def share_conversation(conversation_id: str, body: dict, authorization: str = Header(None)):
    """
    Enable sharing for a conversation.

    Body:
        permission: view or chat (default: view)
        billing: owner or individual (default: owner)
        expires_in: 1h, 24h, 7d, 30d, or null for never (default: 7d)
        max_participants: Maximum number of participants (default: 10)
        participant_access_duration: How long participants can chat - 1h, 24h, 7d, forever, custom (default: forever)
        participant_access_custom_hours: For custom duration, number of hours (required if participant_access_duration is custom)

    Returns share token and URL.
    """
    from backend_code.app import supabase
    from .conversation_sharing import share_conversation as share_conv

    user = await authenticate_request(authorization)

    permission = body.get("permission", "view")
    if permission not in ["view", "chat"]:
        raise HTTPException(status_code=400, detail="Invalid permission. Must be: view or chat")

    billing = body.get("billing", "owner")
    if billing not in ["owner", "individual"]:
        raise HTTPException(status_code=400, detail="Invalid billing. Must be: owner or individual")

    expires_in = body.get("expires_in", "7d")
    if expires_in and expires_in not in ["1h", "24h", "7d", "30d"]:
        raise HTTPException(status_code=400, detail="Invalid expires_in. Must be: 1h, 24h, 7d, 30d, or null")

    max_participants = body.get("max_participants", 10)
    if not isinstance(max_participants, int) or max_participants < 1 or max_participants > 100:
        raise HTTPException(status_code=400, detail="Invalid max_participants. Must be between 1 and 100")

    participant_access_duration = body.get("participant_access_duration", "forever")
    if participant_access_duration not in ["1h", "24h", "7d", "forever", "custom"]:
        raise HTTPException(status_code=400, detail="Invalid participant_access_duration. Must be: 1h, 24h, 7d, forever, or custom")

    participant_access_custom_hours = body.get("participant_access_custom_hours")
    if participant_access_duration == "custom":
        if not participant_access_custom_hours or not isinstance(participant_access_custom_hours, int):
            raise HTTPException(status_code=400, detail="participant_access_custom_hours required for custom duration")
        if participant_access_custom_hours < 1 or participant_access_custom_hours > 8760:  # Max 1 year
            raise HTTPException(status_code=400, detail="participant_access_custom_hours must be between 1 and 8760 (1 year)")

    result = await share_conv(
        supabase, user["id"], conversation_id,
        permission, billing, expires_in, max_participants,
        participant_access_duration, participant_access_custom_hours
    )

    return {
        "object": "conversation_share",
        "data": result
    }


@router.delete("/conversations/{conversation_id}/share")
async def unshare_conversation(conversation_id: str, authorization: str = Header(None)):
    """
    Disable sharing for a conversation.
    """
    from backend_code.app import supabase
    from .conversation_sharing import unshare_conversation as unshare_conv

    user = await authenticate_request(authorization)

    success = await unshare_conv(supabase, user["id"], conversation_id)

    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found or access denied")

    return {"unshared": True}


@router.post("/conversations/join/{share_token}")
async def join_conversation(share_token: str, authorization: str = Header(None)):
    """
    Join a shared conversation using share token.
    """
    from backend_code.app import supabase
    from .conversation_sharing import join_shared_conversation

    user = await authenticate_request(authorization)

    conversation = await join_shared_conversation(supabase, user["id"], share_token)

    return {
        "object": "conversation",
        "data": conversation
    }


@router.delete("/conversations/{conversation_id}/leave")
async def leave_conversation(conversation_id: str, authorization: str = Header(None)):
    """
    Leave a shared conversation.
    """
    from backend_code.app import supabase
    from .conversation_sharing import leave_shared_conversation

    user = await authenticate_request(authorization)

    success = await leave_shared_conversation(supabase, user["id"], conversation_id)

    if not success:
        raise HTTPException(status_code=404, detail="Not a participant of this conversation")

    return {"left": True}


@router.get("/conversations/{conversation_id}/participants")
async def get_participants(conversation_id: str, authorization: str = Header(None)):
    """
    Get list of participants in a conversation.
    """
    from backend_code.app import supabase
    from .conversation_sharing import get_conversation_participants

    user = await authenticate_request(authorization)

    participants = await get_conversation_participants(supabase, conversation_id, user["id"])

    return {
        "object": "list",
        "data": participants
    }


@router.patch("/conversations/{conversation_id}/participants/{participant_id}")
async def update_participant(
    conversation_id: str,
    participant_id: str,
    body: dict,
    authorization: str = Header(None)
):
    """
    Update participant permission (owner only).

    Body:
        permission: view or chat
    """
    from backend_code.app import supabase
    from .conversation_sharing import update_participant_permission

    user = await authenticate_request(authorization)

    permission = body.get("permission")
    if not permission or permission not in ["view", "chat"]:
        raise HTTPException(status_code=400, detail="Invalid permission")

    success = await update_participant_permission(
        supabase, conversation_id, user["id"], participant_id, permission
    )

    if not success:
        raise HTTPException(status_code=404, detail="Participant not found or access denied")

    return {"updated": True}


@router.delete("/conversations/{conversation_id}/participants/{participant_id}")
async def remove_participant(
    conversation_id: str,
    participant_id: str,
    authorization: str = Header(None)
):
    """
    Remove a participant from conversation (owner only).
    """
    from backend_code.app import supabase
    from .conversation_sharing import remove_participant as remove_part

    user = await authenticate_request(authorization)

    success = await remove_part(supabase, conversation_id, user["id"], participant_id)

    if not success:
        raise HTTPException(status_code=404, detail="Participant not found or access denied")

    return {"removed": True}


@router.post("/conversations/{conversation_id}/presence")
async def update_presence(conversation_id: str, body: dict, authorization: str = Header(None)):
    """
    Update user presence in a conversation.

    Body:
        is_typing: boolean
    """
    from backend_code.app import supabase
    from .conversation_sharing import update_presence as update_pres

    user = await authenticate_request(authorization)

    is_typing = body.get("is_typing", False)

    await update_pres(supabase, conversation_id, user["id"], is_typing)

    return {"updated": True}


@router.get("/conversations/{conversation_id}/presence")
async def get_presence(conversation_id: str, authorization: str = Header(None)):
    """
    Get list of users currently active in conversation.
    """
    from backend_code.app import supabase
    from .conversation_sharing import get_active_presence

    user = await authenticate_request(authorization)

    presence = await get_active_presence(supabase, conversation_id)

    return {
        "object": "list",
        "data": presence
    }
