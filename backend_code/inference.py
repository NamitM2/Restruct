"""
Inference: calls the appropriate provider API.
No classes, just functions.
"""

from typing import Dict, Any
from openai import OpenAI
import google.generativeai as genai
from anthropic import Anthropic


def call_openai(model: Dict[str, Any], prompt: str) -> str:
    """Call OpenAI API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    client = OpenAI(api_key=api_key)

    # Reasoning models (o1, o3, gpt-5-pro, etc.) use responses endpoint
    # Check if model uses reasoning endpoint based on name patterns
    reasoning_models = ["o1-", "o3-", "gpt-5-pro", "gpt-5_pro"]
    is_reasoning_model = any(pattern in model_name for pattern in reasoning_models)

    if is_reasoning_model:
        # For reasoning models: use v1/responses endpoint
        response = client.responses.create(
            model=model_name,
            input=prompt
        )
        return response.output
    else:
        # For chat models: use v1/chat/completions endpoint
        response = client.chat.completions.create(
            model=model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000,
            temperature=0.7
        )
        return response.choices[0].message.content


def call_google(model: Dict[str, Any], prompt: str) -> str:
    """Call Google Gemini API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    genai.configure(api_key=api_key)
    gemini_model = genai.GenerativeModel(model_name)

    response = gemini_model.generate_content(prompt)

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
