"""
Inference Engine for Restruct
Handles API calls to different LLM providers
"""

import os
from typing import Dict, Optional
import asyncio


class InferenceEngine:
    """Manages API calls to various LLM providers"""

    def __init__(self):
        self.openai_client = None
        self.google_client = None
        self.anthropic_client = None

    def _get_openai_client(self):
        """Lazy initialization of OpenAI client"""
        if self.openai_client is None:
            try:
                from openai import AsyncOpenAI
                self.openai_client = AsyncOpenAI(
                    api_key=os.getenv("OPENAI_API_KEY")
                )
            except ImportError:
                raise ImportError("OpenAI package not installed. Run: pip install openai")
        return self.openai_client

    def _get_google_client(self):
        """Lazy initialization of Google client"""
        if self.google_client is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
                self.google_client = genai
            except ImportError:
                raise ImportError("Google Generative AI package not installed. Run: pip install google-generativeai")
        return self.google_client

    def _get_anthropic_client(self):
        """Lazy initialization of Anthropic client"""
        if self.anthropic_client is None:
            try:
                from anthropic import AsyncAnthropic
                self.anthropic_client = AsyncAnthropic(
                    api_key=os.getenv("ANTHROPIC_API_KEY")
                )
            except ImportError:
                raise ImportError("Anthropic package not installed. Run: pip install anthropic")
        return self.anthropic_client

    async def call_openai(
        self,
        model: str,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Dict[str, any]:
        """Call OpenAI API"""
        try:
            client = self._get_openai_client()

            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature
            )

            return {
                "output": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "model": response.model,
                "finish_reason": response.choices[0].finish_reason
            }
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")

    async def call_google(
        self,
        model: str,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Dict[str, any]:
        """Call Google Gemini API"""
        try:
            genai = self._get_google_client()

            # Initialize the model
            gemini_model = genai.GenerativeModel(model)

            # Generate response
            response = await asyncio.to_thread(
                gemini_model.generate_content,
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=max_tokens,
                    temperature=temperature
                )
            )

            return {
                "output": response.text,
                "usage": {
                    "prompt_tokens": response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else 0,
                    "completion_tokens": response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else 0,
                    "total_tokens": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0
                },
                "model": model,
                "finish_reason": "stop"
            }
        except Exception as e:
            raise Exception(f"Google API error: {str(e)}")

    async def call_anthropic(
        self,
        model: str,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Dict[str, any]:
        """Call Anthropic Claude API"""
        try:
            client = self._get_anthropic_client()

            response = await client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}]
            )

            return {
                "output": response.content[0].text,
                "usage": {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                },
                "model": response.model,
                "finish_reason": response.stop_reason
            }
        except Exception as e:
            raise Exception(f"Anthropic API error: {str(e)}")

    async def run_inference(
        self,
        provider: str,
        model: str,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Dict[str, any]:
        """
        Run inference using the specified provider and model

        Args:
            provider: Provider name ("openai", "google", "anthropic")
            model: Model name
            prompt: User prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature

        Returns:
            Dictionary with model output and metadata
        """
        if provider == "openai":
            return await self.call_openai(model, prompt, max_tokens, temperature)
        elif provider == "google":
            return await self.call_google(model, prompt, max_tokens, temperature)
        elif provider == "anthropic":
            return await self.call_anthropic(model, prompt, max_tokens, temperature)
        else:
            raise ValueError(f"Unknown provider: {provider}")
