"""
Response format conversion to OpenAI-compatible structure.
"""

import time
import uuid
from .schemas import (
    ChatCompletionResponse,
    ChatCompletionChoice,
    ChatCompletionMessage,
    UsageInfo,
    RestructMetadata
)


def create_completion_response(
    model_name: str,
    provider: str,
    response_text: str,
    input_tokens: int,
    output_tokens: int,
    routing_metadata: dict = None,
    profile_used: str = None
) -> ChatCompletionResponse:
    """
    Create OpenAI-compatible completion response.

    Args:
        model_name: Name of model used (e.g., "gpt-5", "claude-sonnet-4-5")
        provider: Provider name ("openai", "anthropic", "google")
        response_text: Generated text from LLM
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        routing_metadata: Optional routing metadata (scores, timing)
        profile_used: Optional profile slug used for routing

    Returns:
        ChatCompletionResponse in OpenAI format
    """

    # Generate unique completion ID
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"

    # Create response
    return ChatCompletionResponse(
        id=completion_id,
        created=int(time.time()),
        model=model_name,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=ChatCompletionMessage(
                    role="assistant",
                    content=response_text
                ),
                finish_reason="stop"
            )
        ],
        usage=UsageInfo(
            prompt_tokens=input_tokens,
            completion_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens
        ),
        restruct=RestructMetadata(
            provider=provider,
            routing_score=routing_metadata.get("score") if routing_metadata else None,
            profile_used=profile_used,
            routing_time_ms=routing_metadata.get("routing_time_ms") if routing_metadata else None,
            inference_time_ms=routing_metadata.get("inference_time_ms") if routing_metadata else None
        )
    )


def parse_model_parameter(model: str) -> tuple:
    """
    Parse model parameter into (provider, model_name).

    Examples:
        "auto" → (None, None)  # Triggers smart routing
        "openai:gpt-5" → ("openai", "gpt-5")
        "anthropic:claude-opus-4-1" → ("anthropic", "claude-opus-4-1")
        "gpt-4" → ("openai", "gpt-5")  # Alias mapping

    Returns:
        (provider, model_name) or (None, None) for auto routing
    """

    # Auto routing
    if model == "auto":
        return None, None

    # Provider:model format
    if ":" in model:
        provider, model_name = model.split(":", 1)
        return provider, model_name

    # OpenAI model aliases for compatibility
    OPENAI_ALIASES = {
        "gpt-4": "gpt-5",
        "gpt-4o": "gpt-5",
        "gpt-4o-mini": "gpt-5-mini",
        "gpt-3.5-turbo": "gpt-5-nano"
    }

    if model in OPENAI_ALIASES:
        return "openai", OPENAI_ALIASES[model]

    # Default to auto if unknown
    return None, None
