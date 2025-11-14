"""
FastAPI app: orchestrates routing + inference.
Minimal endpoints, no error handling (errors will bubble up).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import os

from backend_code.router import route, route_specific, route_with_llm
from backend_code.inference import inference

app = FastAPI(title="Restruct API", version="0.1.0")

# CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    prompt: str
    priority: Optional[str] = "balanced"
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    router_mode: Optional[str] = "auto"
    model_override: Optional[str] = None


@app.get("/")
def root():
    """Health check."""
    return {
        "status": "online",
        "service": "Restruct Model Router",
        "version": "0.1.0"
    }


@app.post("/chat")
def chat(request: ChatRequest):
    """
    Main chat endpoint.

    Returns format expected by frontend:
    {
        "output": str,
        "model": str,
        "provider": str,
        "routing_metadata": {"score": float}
    }
    """

    model_choice = resolve_model_choice(request)

    response_text = inference(model_choice, request.prompt)

    # Format response for frontend
    return {
        "output": response_text,
        "model": model_choice["model_name"],
        "provider": model_choice["vendor"],
        "routing_metadata": {
            "score": model_choice["score"]
        }
    }


def resolve_model_choice(request: ChatRequest):
    """
    Decide how to obtain a model: router-driven or manual override.
    """
    if request.router_mode == "manual":
        if not request.model_override:
            raise ValueError("Manual routing mode requires a model selection.")

        if ":" not in request.model_override:
            raise ValueError("Model override must use 'provider:model_name' format.")

        provider, model_name = request.model_override.split(":", 1)
        return route_specific(provider, model_name)
    model, model_scores = route_with_llm(request.prompt)
    return model


# Mount frontend static files (go up one directory)
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
