"""
FastAPI Application for Restruct
Main backend server that handles routing between frontend and logic modules
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict
import uvicorn

from router import ModelRouter
from inference import InferenceEngine
from database import Database


# Initialize FastAPI app
app = FastAPI(
    title="Restruct API",
    description="Smart model router for LLM APIs",
    version="0.1.0"
)

# Configure CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
router = ModelRouter()
inference_engine = InferenceEngine()
database = Database()


# Request/Response Models
class ChatRequest(BaseModel):
    prompt: str
    priority: Optional[str] = "balanced"  # "cost", "performance", or "balanced"
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.7
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    output: str
    model: str
    provider: str
    routing_metadata: Dict
    usage: Dict


class RoutingRequest(BaseModel):
    prompt: str
    priority: Optional[str] = "balanced"


# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Restruct Model Router",
        "version": "0.1.0"
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chat endpoint - routes prompt to optimal model and returns response

    Args:
        request: ChatRequest with prompt and optional parameters

    Returns:
        ChatResponse with model output and metadata
    """
    try:
        # Step 1: Route to best model
        routing_result = router.route(
            prompt=request.prompt,
            priority=request.priority
        )

        # Step 2: Run inference
        inference_result = await inference_engine.run_inference(
            provider=routing_result["provider"],
            model=routing_result["model"],
            prompt=request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )

        # Step 3: Save to database (optional, non-blocking)
        try:
            await database.save_interaction(
                prompt=request.prompt,
                model=routing_result["model"],
                provider=routing_result["provider"],
                output=inference_result["output"],
                routing_metadata=routing_result,
                usage=inference_result["usage"],
                user_id=request.user_id
            )
        except Exception as db_error:
            print(f"Database save failed (non-critical): {db_error}")

        # Step 4: Return response
        return ChatResponse(
            output=inference_result["output"],
            model=routing_result["model"],
            provider=routing_result["provider"],
            routing_metadata=routing_result,
            usage=inference_result["usage"]
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.post("/routing/route")
async def route_only(request: RoutingRequest):
    """
    Routing endpoint - returns which model would be selected without running inference

    Args:
        request: RoutingRequest with prompt and priority

    Returns:
        Routing decision metadata
    """
    try:
        routing_result = router.route(
            prompt=request.prompt,
            priority=request.priority
        )
        return routing_result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.get("/models")
async def list_models():
    """Get list of all available models"""
    from models_config import get_all_models
    return {"models": get_all_models()}


@app.get("/stats")
async def get_stats():
    """Get usage statistics"""
    try:
        stats = await database.get_model_stats()
        return stats
    except Exception as e:
        return {"error": str(e)}


# Mount frontend static files
try:
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
except Exception:
    print("Warning: Frontend directory not found. API-only mode.")


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
