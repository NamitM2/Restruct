"""
Request/Response schemas for OpenAI-compatible API.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime


# ============================================================================
# REQUEST MODELS
# ============================================================================

class ChatMessage(BaseModel):
    """Single message in conversation."""
    role: Literal["system", "user", "assistant"]
    content: str


class RestructParams(BaseModel):
    """Optional Restruct-specific parameters."""
    profile: Optional[str] = None  # Profile slug for routing
    router_mode: Literal["auto", "manual"] = "auto"
    conversation_id: Optional[str] = None  # For shared conversation billing and rate limiting


class ChatCompletionRequest(BaseModel):
    """OpenAI-compatible chat completion request."""
    model: str = Field(default="auto", description="Model to use or 'auto' for smart routing")
    messages: List[ChatMessage]
    temperature: Optional[float] = Field(default=1.0, ge=0.0, le=2.0)
    max_tokens: Optional[int] = None
    stream: bool = False
    restruct: Optional[RestructParams] = None  # Restruct-specific params


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class ChatCompletionMessage(BaseModel):
    """Message in completion response."""
    role: Literal["assistant"]
    content: str


class ChatCompletionChoice(BaseModel):
    """Single completion choice."""
    index: int
    message: ChatCompletionMessage
    finish_reason: Literal["stop", "length"]


class UsageInfo(BaseModel):
    """Token usage information."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class RestructMetadata(BaseModel):
    """Restruct-specific metadata."""
    provider: str  # "openai" | "anthropic" | "google"
    routing_score: Optional[float] = None
    profile_used: Optional[str] = None
    routing_time_ms: Optional[float] = None
    inference_time_ms: Optional[float] = None


class ChatCompletionResponse(BaseModel):
    """OpenAI-compatible chat completion response."""
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int  # Unix timestamp
    model: str
    choices: List[ChatCompletionChoice]
    usage: UsageInfo
    restruct: RestructMetadata  # Extra metadata
