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
    # 4. STREAMING vs NON-STREAMING
    # ========================================================================

    if request.stream:
        # Streaming response
        from .openai_compat import create_streaming_chunk, create_streaming_done

        async def stream_generator():
            chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

            try:
                async for chunk in inference.inference_stream(model_choice, conversation):
                    if chunk.get("done"):
                        # Final chunk with usage
                        sse_chunk = create_streaming_chunk(
                            chunk_id=chunk_id,
                            model_name=model_choice["model_name"],
                            delta_content="",
                            done=True,
                            finish_reason="stop",
                            usage=chunk.get("usage")
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
                # Send error as SSE comment
                yield f": Error - {str(e)}\n\n"
                yield create_streaming_done()

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream"
        )

    # ========================================================================
    # 5. NON-STREAMING INFERENCE
    # ========================================================================

    inference_start = time.time()

    try:
        result = await inference.inference(model_choice, conversation)
        response_text = result["text"]
        input_tokens = result["input_tokens"]
        output_tokens = result["output_tokens"]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {str(e)}"
        )

    inference_time = (time.time() - inference_start) * 1000  # ms

    # ========================================================================
    # 6. FORMAT RESPONSE
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
    name: Optional[str] = Query(None)
):
    """
    Create a new API key.

    The key is only shown once - save it securely.
    """
    from backend_code.app import supabase
    from .api_keys import create_api_key

    user = await authenticate_request(authorization)

    result = await create_api_key(supabase, user["id"], name)

    return {
        "id": result["id"],
        "key": result["key"],
        "key_prefix": result["key_prefix"],
        "name": result["name"],
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
