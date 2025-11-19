"""
Inference: calls the appropriate provider API.
No classes, just functions.
"""

from typing import Dict, Any, List, Union
from openai import OpenAI
from google import genai
from anthropic import Anthropic


def _normalize_conversation(conversation: Union[str, List[Dict[str, Any]]]) -> List[Dict[str, str]]:
    """Ensure we always work with a role/content list."""

    normalized = []
    for message in conversation:
        role = (message.get("role") or "user").lower()
        content = message.get("content") or ""
        normalized.append({"role": role, "content": content})

    return normalized


def _conversation_to_google_history(conversation: Union[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Map conversation to Gemini's expected role/parts format."""
    history = []
    for message in _normalize_conversation(conversation):
        role = message["role"]
        mapped_role = "user"
        if role in {"assistant", "model"}:
            mapped_role = "model"
        history.append({
            "role": mapped_role,
            "parts": [{"text": message["content"]}]
        })
    return history


def _conversation_to_anthropic(conversation: Union[str, List[Dict[str, Any]]]) -> List[Dict[str, str]]:
    """Anthropic only supports 'user' and 'assistant' roles."""
    formatted = []
    for message in _normalize_conversation(conversation):
        role = message["role"]
        if role not in {"assistant"}:
            role = "user"
        formatted.append({
            "role": role,
            "content": message["content"]
        })
    return formatted


def call_openai(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Call OpenAI API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=model_name,
        input=_normalize_conversation(conversation)
    )

    return {
        "text": response.output_text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens
    }
 


def call_google(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Call Google Gemini API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=_conversation_to_google_history(conversation)
    )

    return {
        "text": response.text,
        "input_tokens": response.usage_metadata.prompt_token_count,
        "output_tokens": response.usage_metadata.candidates_token_count
    }


def call_anthropic(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Call Anthropic Claude API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model_name,
        max_tokens=1000,
        messages=_conversation_to_anthropic(conversation)
    )

    return {
        "text": response.content[0].text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens
    }


def infer(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """
    Run inference on selected model.

    Args:
        model: Model dict from router
        conversation: Conversation history

    Returns:
        Dict with text, input_tokens, output_tokens
    """
    vendor = model["vendor"]

    if vendor == "openai":
        return call_openai(model, conversation)
    elif vendor == "google":
        return call_google(model, conversation)
    elif vendor == "anthropic":
        return call_anthropic(model, conversation)

    return {"text": f"Unsupported vendor: {vendor}", "input_tokens": 0, "output_tokens": 0}


def inference(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Main inference function."""
    return infer(model, conversation)
