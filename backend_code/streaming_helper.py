"""
Streaming chat helper functions.

This module contains the logic for streaming chat responses with routing events.
Keeps app.py clean by extracting the streaming implementation details.
"""

from typing import Dict, Any, AsyncGenerator
import json
import time


async def generate_chat_events(
    prompt: str,
    conversation_id: str,
    router_mode: str,
    model_override: str,
    profile: str,
    user_id: str,
    add_message_func,
    get_conversation_func,
    resolve_model_func,
    inference_func
) -> AsyncGenerator[str, None]:
    """
    Generate Server-Sent Events for streaming chat responses.
    
    Yields two events:
    1. Routing complete event (with model info)
    2. Inference complete event (with response)
    
    Args:
        prompt: User's message
        conversation_id: Conversation ID
        router_mode: Routing mode (auto/manual)
        model_override: Model override string
        profile: Profile name
        user_id: User ID
        add_message_func: Function to add messages to DB
        get_conversation_func: Function to get conversation messages
        resolve_model_func: Function to resolve model choice
        inference_func: Function to call LLM API
        
    Yields:
        SSE formatted event strings
    """
    from backend_code.api_call_metadata import (
        create_routing_complete_event,
        create_inference_complete_event,
        get_model_display_info
    )
    import asyncio
    
    # Add user message to conversation
    add_message_func(
        conversation_id=conversation_id,
        role="user",
        content=prompt
    )
    conversation = get_conversation_func(conversation_id)

    # PHASE 1: ROUTING
    routing_start = time.time()
    model_choice = resolve_model_func(router_mode, model_override, conversation)
    routing_time = time.time() - routing_start

    # Create and send routing complete event
    routing_event = create_routing_complete_event(
        model_choice=model_choice,
        routing_time_seconds=routing_time,
        routing_model="gemini"
    )
    routing_event["conversation_id"] = conversation_id
    
    # Add model display info
    model_display = get_model_display_info(
        provider=model_choice["vendor"],
        model_name=model_choice["model_name"]
    )
    routing_event["model_display"] = model_display
    
    yield f"data: {json.dumps(routing_event)}\n\n"
    
    # Small delay to ensure routing event is sent before inference starts
    await asyncio.sleep(0.001)  # 1ms delay to flush the buffer

    # PHASE 2: INFERENCE
    inference_start = time.time()
    response_data = inference_func(model_choice, conversation)
    inference_time = time.time() - inference_start

    response_text = response_data["text"]

    # Save assistant message to database
    add_message_func(
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

    # Create and send complete response event
    response_event = create_inference_complete_event(
        response_text=response_text,
        model_choice=model_choice,
        response_data=response_data,
        routing_time_seconds=routing_time,
        inference_time_seconds=inference_time,
        routing_model="gemini"
    )
    response_event["conversation_id"] = conversation_id
    response_event["model_display"] = model_display

    yield f"data: {json.dumps(response_event)}\n\n"


def create_sse_response(event_generator):
    """
    Create a StreamingResponse for Server-Sent Events.
    
    Args:
        event_generator: Async generator that yields SSE events
        
    Returns:
        FastAPI StreamingResponse configured for SSE
    """
    from fastapi.responses import StreamingResponse
    
    return StreamingResponse(
        event_generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
