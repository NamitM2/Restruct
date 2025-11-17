"""
Inference: calls the appropriate provider API.
No classes, just functions.
"""

from typing import Dict, Any
from openai import OpenAI
from google import genai
from anthropic import Anthropic


def call_openai(model: Dict[str, Any], prompt: str) -> str:
    """Call OpenAI API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=model_name,
        input=[{"role": "user", "content": prompt}]
    )
    return response.output_text
 


def call_google(model: Dict[str, Any], prompt: str) -> str:
    """Call Google Gemini API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt
    )

    return response.text


def call_anthropic(model: Dict[str, Any], prompt: str) -> str:
    """Call Anthropic Claude API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = Anthropic(api_key=api_key)

    response = client.messages.create(
        model=model_name,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )

    return response.content[0].text


def infer(model: Dict[str, Any], prompt: str) -> str:
    """
    Run inference on selected model.

    Args:
        model: Model dict from router
        prompt: User's prompt

    Returns:
        Model's response text
    """
    vendor = model["vendor"]

    if vendor == "openai":
        return call_openai(model, prompt)
    elif vendor == "google":
        return call_google(model, prompt)
    elif vendor == "anthropic":
        return call_anthropic(model, prompt)

    return f"Unsupported vendor: {vendor}"


def inference(model: Dict[str, Any], prompt: str) -> str:
    """Main inference function."""
    return infer(model, prompt)
