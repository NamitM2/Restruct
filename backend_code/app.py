"""
FastAPI app: orchestrates routing + inference.
Minimal endpoints, no error handling (errors will bubble up).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from typing import Optional
import os
import json
import asyncio

from backend_code.router import route, route_specific, route_with_llm
from backend_code.inference import inference
from backend_code.database import (
    create_conversation,
    add_message,
    get_user_conversations,
    get_conversation_messages,
    create_routing_profile,
    get_routing_profiles
)

app = FastAPI(title="Restruct API", version="0.1.0")
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
    """
    Main chat endpoint with streaming support.

    Streams events:
    1. routing_complete: When model is selected
    2. response_complete: When inference finishes
    """

    prompt = body.get("prompt")
    router_mode = body.get("router_mode", "auto")
    model_override = body.get("model_override")
    conversation_id = body.get("conversation_id")
    user_id = body.get("user_id", DEFAULT_USER_ID)
    profile = body.get("profile", "default")

    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id is required")

    async def event_generator():
        import time

        add_message(
            conversation_id=conversation_id,
            role="user",
            content=prompt
        )

        routing_start = time.time()
        model_choice = resolve_model_choice(router_mode, model_override, prompt)
        routing_time = time.time() - routing_start

        routing_event = {
            "event": "routing_complete",
            "model": model_choice["model_name"],
            "provider": model_choice["vendor"],
            "routing_time": round(routing_time * 1000, 2)
        }
        yield f"data: {json.dumps(routing_event)}\n\n"

        inference_start = time.time()
        response_data = inference(model_choice, prompt)
        inference_time = time.time() - inference_start

        response_text = response_data["text"]
        input_tokens = response_data["input_tokens"]
        output_tokens = response_data["output_tokens"]

        input_cost = model_choice["config"]["input_token_cost"]
        output_cost = model_choice["config"]["output_token_cost"]
        total_cost = (input_tokens * input_cost) + (output_tokens * output_cost)

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

        response_event = {
            "event": "response_complete",
            "output": response_text,
            "model": model_choice["model_name"],
            "provider": model_choice["vendor"],
            "routing_metadata": {
                "score": model_choice["score"]
            },
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cost": total_cost
            },
            "timing": {
                "routing_time": round(routing_time * 1000, 2),
                "inference_time": round(inference_time * 1000, 2)
            },
            "conversation_id": conversation_id
        }
        yield f"data: {json.dumps(response_event)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
