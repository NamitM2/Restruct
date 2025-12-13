"""
Inference: calls the appropriate provider API.
No classes, just functions.
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
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


async def call_openai(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Call OpenAI API."""
    api_key = model["api_key"]
    model_name = model["model_name"]
    logs_dir = Path(__file__).resolve().parents[1] / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    normalized_conv = _normalize_conversation(conversation)
    log_path = logs_dir / f"log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    log_payload = {
        "model": model_name,
        "vendor": model.get("vendor"),
        "conversation": normalized_conv,
    }
    log_path.write_text(json.dumps(log_payload, ensure_ascii=True, indent=2))

    def _call():
        client = OpenAI(api_key=api_key)
        return client.responses.create(
            model=model_name,
            input=normalized_conv
        )

    response = await asyncio.to_thread(_call)

    return {
        "text": response.output_text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens
    }
 


async def call_google(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Call Google Gemini API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    def _call():
        client = genai.Client(api_key=api_key)
        return client.models.generate_content(
            model=model_name,
            contents=_conversation_to_google_history(conversation)
        )

    response = await asyncio.to_thread(_call)

    return {
        "text": response.text,
        "input_tokens": response.usage_metadata.prompt_token_count,
        "output_tokens": response.usage_metadata.candidates_token_count
    }


async def call_anthropic(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Call Anthropic Claude API."""
    api_key = model["api_key"]
    model_name = model["model_name"]

    def _call():
        client = Anthropic(api_key=api_key)
        return client.messages.create(
            model=model_name,
            max_tokens=1000,
            messages=_conversation_to_anthropic(conversation)
        )

    response = await asyncio.to_thread(_call)

    return {
        "text": response.content[0].text,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens
    }


async def infer(model: Dict[str, Any], conversation) -> Dict[str, Any]:
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
        return await call_openai(model, conversation)
    elif vendor == "google":
        return await call_google(model, conversation)
    elif vendor == "anthropic":
        return await call_anthropic(model, conversation)

    return {"text": f"Unsupported vendor: {vendor}", "input_tokens": 0, "output_tokens": 0}


async def inference(model: Dict[str, Any], conversation) -> Dict[str, Any]:
    """Main inference function."""
    return await infer(model, conversation)


# ============================================================================
# STREAMING FUNCTIONS
# ============================================================================

async def call_openai_stream(model: Dict[str, Any], conversation):
    """Stream from OpenAI API. Yields chunks with delta content."""
    import queue
    import threading

    api_key = model["api_key"]
    model_name = model["model_name"]
    normalized_conv = _normalize_conversation(conversation)

    q = queue.Queue()

    def stream_in_thread():
        try:
            client = OpenAI(api_key=api_key)
            stream = client.chat.completions.create(
                model=model_name,
                messages=normalized_conv,
                stream=True
            )

            last_chunk = None
            for chunk in stream:
                last_chunk = chunk
                delta = chunk.choices[0].delta
                if delta.content:
                    q.put({"delta": delta.content, "done": False})

            # Final chunk with usage
            if last_chunk and hasattr(last_chunk, 'usage') and last_chunk.usage:
                q.put({
                    "delta": "",
                    "done": True,
                    "usage": {
                        "input_tokens": last_chunk.usage.prompt_tokens,
                        "output_tokens": last_chunk.usage.completion_tokens
                    }
                })
            else:
                q.put({"delta": "", "done": True})
        except Exception as e:
            q.put({"error": str(e)})
        finally:
            q.put(None)  # Signal completion

    thread = threading.Thread(target=stream_in_thread)
    thread.start()

    # Yield chunks from queue
    while True:
        chunk = await asyncio.to_thread(q.get)
        if chunk is None:
            break
        if "error" in chunk:
            raise Exception(chunk["error"])
        yield chunk


async def call_google_stream(model: Dict[str, Any], conversation):
    """Stream from Google Gemini API. Yields chunks with delta content."""
    import queue
    import threading

    api_key = model["api_key"]
    model_name = model["model_name"]

    q = queue.Queue()

    def stream_in_thread():
        try:
            client = genai.Client(api_key=api_key)
            stream = client.models.generate_content_stream(
                model=model_name,
                contents=_conversation_to_google_history(conversation)
            )

            input_tokens = 0
            output_tokens = 0

            for chunk in stream:
                if hasattr(chunk, 'text') and chunk.text:
                    q.put({"delta": chunk.text, "done": False})

                if hasattr(chunk, 'usage_metadata'):
                    input_tokens = chunk.usage_metadata.prompt_token_count
                    output_tokens = chunk.usage_metadata.candidates_token_count

            # Final chunk
            q.put({
                "delta": "",
                "done": True,
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens
                }
            })
        except Exception as e:
            q.put({"error": str(e)})
        finally:
            q.put(None)

    thread = threading.Thread(target=stream_in_thread)
    thread.start()

    while True:
        chunk = await asyncio.to_thread(q.get)
        if chunk is None:
            break
        if "error" in chunk:
            raise Exception(chunk["error"])
        yield chunk


async def call_anthropic_stream(model: Dict[str, Any], conversation):
    """Stream from Anthropic Claude API. Yields chunks with delta content."""
    import queue
    import threading

    api_key = model["api_key"]
    model_name = model["model_name"]

    q = queue.Queue()

    def stream_in_thread():
        try:
            client = Anthropic(api_key=api_key)
            stream = client.messages.create(
                model=model_name,
                max_tokens=1000,
                messages=_conversation_to_anthropic(conversation),
                stream=True
            )

            input_tokens = 0
            output_tokens = 0

            for event in stream:
                if event.type == "content_block_delta":
                    if hasattr(event.delta, 'text') and event.delta.text:
                        q.put({"delta": event.delta.text, "done": False})

                elif event.type == "message_stop":
                    if hasattr(event, 'message') and hasattr(event.message, 'usage'):
                        input_tokens = event.message.usage.input_tokens
                        output_tokens = event.message.usage.output_tokens

            # Final chunk
            q.put({
                "delta": "",
                "done": True,
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens
                }
            })
        except Exception as e:
            q.put({"error": str(e)})
        finally:
            q.put(None)

    thread = threading.Thread(target=stream_in_thread)
    thread.start()

    while True:
        chunk = await asyncio.to_thread(q.get)
        if chunk is None:
            break
        if "error" in chunk:
            raise Exception(chunk["error"])
        yield chunk


async def inference_stream(model: Dict[str, Any], conversation):
    """Main streaming inference function. Yields chunks from the selected provider."""
    vendor = model["vendor"]

    if vendor == "openai":
        async for chunk in call_openai_stream(model, conversation):
            yield chunk
    elif vendor == "google":
        async for chunk in call_google_stream(model, conversation):
            yield chunk
    elif vendor == "anthropic":
        async for chunk in call_anthropic_stream(model, conversation):
            yield chunk
    else:
        yield {"delta": f"Unsupported vendor: {vendor}", "done": True, "usage": {"input_tokens": 0, "output_tokens": 0}}
