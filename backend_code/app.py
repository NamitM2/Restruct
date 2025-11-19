"""
FastAPI app: orchestrates routing + inference.
Minimal endpoints, no error handling (errors will bubble up).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
from contextlib import asynccontextmanager
import os

from backend_code.router import route_specific, route_with_llm
from backend_code.inference import inference
from backend_code.database import (
    create_conversation,
    add_message,
    get_user_conversations,
    get_conversation_messages,
    create_routing_profile,
    get_routing_profiles
)


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
    """Main chat endpoint with enhanced metadata tracking."""
    from backend_code.api_call_metadata import (
        create_inference_complete_event,
        get_model_display_info
    )
    
    prompt = body.get("prompt")
    router_mode = body.get("router_mode", "auto")
    model_override = body.get("model_override")
    conversation_id = body.get("conversation_id")
    user_id = body.get("user_id", DEFAULT_USER_ID)
    profile = body.get("profile", "default")

    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")

    import time

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
    response_data = inference(model_choice, conversation)
    inference_time = time.time() - inference_start

    response_text = response_data["text"]

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

    # Create complete response event with all metadata
    response_event = create_inference_complete_event(
        response_text=response_text,
        model_choice=model_choice,
        response_data=response_data,
        routing_time_seconds=routing_time,
        inference_time_seconds=inference_time,
        routing_model="gemini"  # Currently using Gemini for routing
    )
    
    # Add conversation_id to response
    response_event["conversation_id"] = conversation_id
    
    # Add model display info for frontend
    model_display = get_model_display_info(
        provider=model_choice["vendor"],
        model_name=model_choice["model_name"]
    )
    response_event["model_display"] = model_display

    return response_event


@app.post("/chat/stream")
async def chat_stream(body: dict):
    """Streaming chat endpoint with routing complete event."""
    from backend_code.streaming_helper import generate_chat_events, create_sse_response
    
    prompt = body.get("prompt")
    router_mode = body.get("router_mode", "auto")
    model_override = body.get("model_override")
    conversation_id = body.get("conversation_id")
    user_id = body.get("user_id", DEFAULT_USER_ID)
    profile = body.get("profile", "default")

    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")

    event_generator = generate_chat_events(
        prompt=prompt,
        conversation_id=conversation_id,
        router_mode=router_mode,
        model_override=model_override,
        profile=profile,
        user_id=user_id,
        add_message_func=add_message,
        get_conversation_func=get_conversation_messages,
        resolve_model_func=resolve_model_choice,
        inference_func=inference
    )
    
    return create_sse_response(event_generator)


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
        return route_specific(provider, model_name)
    model, model_scores = route_with_llm(conversation)
    return model


@app.get("/models/info")
def get_model_info(provider: str, model_name: str):
    """Get display information for a specific model."""
    from backend_code.api_call_metadata import get_model_display_info, get_model_max_tokens
    
    model_display = get_model_display_info(provider, model_name)
    max_tokens = get_model_max_tokens(provider, model_name)
    
    return {
        "success": True,
        "model_info": {
            **model_display,
            "max_tokens": max_tokens
        }
    }


@app.post("/models/estimate-cost")
def estimate_model_cost(body: dict):
    """Estimate cost for a model given estimated token counts."""
    from backend_code.api_call_metadata import estimate_cost_for_model
    
    provider = body.get("provider")
    model_name = body.get("model_name")
    estimated_input_tokens = body.get("estimated_input_tokens", 0)
    estimated_output_tokens = body.get("estimated_output_tokens", 0)
    
    if not provider or not model_name:
        raise HTTPException(status_code=400, detail="provider and model_name are required")
    
    cost_estimate = estimate_cost_for_model(
        estimated_input_tokens=estimated_input_tokens,
        estimated_output_tokens=estimated_output_tokens,
        provider=provider,
        model_name=model_name
    )
    
    if not cost_estimate:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return {
        "success": True,
        "cost_estimate": cost_estimate.to_dict()
    }


@app.get("/models/list")
def list_available_models():
    """List all available models with their display information."""
    from backend_code.api_call_metadata import get_model_display_info
    from backend_code.models_config import MODELS
    
    models_list = []
    for provider, config in MODELS.items():
        for model_name, model_config in config.get("models", {}).items():
            model_display = get_model_display_info(provider, model_name)
            models_list.append({
                **model_display,
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
