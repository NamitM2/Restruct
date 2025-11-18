"""
Inference: calls the appropriate provider API.
No classes, just functions.
"""

from typing import Dict, Any
from openai import OpenAI
from google import genai
from anthropic import Anthropic


def call_openai(model: Dict[str, Any], prompt: str) -> Dict[str, Any]:
    """Call OpenAI API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=model_name,
        input=[{"role": "user", "content": prompt}]
    )

    return {
        "text": response.output_text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens
    }
 


def call_google(model: Dict[str, Any], prompt: str) -> Dict[str, Any]:
    """Call Google Gemini API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt
    )

    return {
        "text": response.text,
        "input_tokens": response.usage_metadata.prompt_token_count,
        "output_tokens": response.usage_metadata.candidates_token_count
    }


def call_anthropic(model: Dict[str, Any], prompt: str) -> Dict[str, Any]:
    """Call Anthropic Claude API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model_name,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    return {
        "text": response.content[0].text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens
    }


def infer(model: Dict[str, Any], prompt: str) -> Dict[str, Any]:
    """
    Run inference on selected model.

    Args:
        model: Model dict from router
        prompt: User's prompt

    Returns:
        Dict with text, input_tokens, output_tokens
    """
    vendor = model["vendor"]

    if vendor == "openai":
        return call_openai(model, prompt)
    elif vendor == "google":
        return call_google(model, prompt)
    elif vendor == "anthropic":
        return call_anthropic(model, prompt)

    return {"text": f"Unsupported vendor: {vendor}", "input_tokens": 0, "output_tokens": 0}


def inference(model: Dict[str, Any], prompt: str) -> Dict[str, Any]:
    """Main inference function."""
    return infer(model, prompt)
