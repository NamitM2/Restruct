"""
Local LLM Router using Phi-3.5-Mini-Instruct for prompt assessment.
Replaces Gemini API calls with local inference for faster routing.
"""

from typing import Dict, Any
import json
import re
import os


class LocalLLMRouter:
    """Singleton router using local Phi-3.5-Mini model for prompt assessment."""

    _instance = None
    _model = None
    _has_gpu = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._has_gpu is None:
            self._detect_gpu()
        if self._model is None and self._has_gpu:
            self._initialize_model()

    def _detect_gpu(self):
        """Detect if GPU is available for inference."""
        try:
            import torch
            self._has_gpu = torch.cuda.is_available()
            if self._has_gpu:
                print(f"GPU detected: {torch.cuda.get_device_name(0)}")
            else:
                print("No GPU detected - will use Gemini API routing")
        except ImportError:
            self._has_gpu = False
            print("PyTorch not available - will use Gemini API routing")

    def has_gpu(self) -> bool:
        """Check if GPU is available."""
        return self._has_gpu or False

    def _initialize_model(self):
        """Load Phi-3.5-Mini model using llama-cpp-python."""
        try:
            from llama_cpp import Llama
        except ImportError:
            raise ImportError(
                "llama-cpp-python is not installed. "
                "Install with: pip install llama-cpp-python"
            )

        model_path = os.path.join(
            os.path.dirname(__file__),
            "models",
            "Phi-3.5-mini-instruct-Q4_K_M.gguf"
        )

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model not found at {model_path}\n"
                f"Download from: https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf\n"
                f"Place in: backend_code/models/"
            )

        print(f"Loading Phi-3.5-Mini model from {model_path}...")

        n_threads = os.cpu_count() or 4

        self._model = Llama(
            model_path=model_path,
            n_ctx=512,
            n_threads=n_threads,
            n_gpu_layers=-1,  # Offload all layers to GPU
            n_batch=512,  # Larger batch for faster GPU processing
            verbose=False
        )
        print(f"Model loaded successfully! (GPU mode with {n_threads} CPU threads)")

    def assess_prompt(self, prompt: str) -> Dict[str, float]:
        """
        Assess prompt complexity using local LLM.

        Args:
            prompt: User's prompt to assess

        Returns:
            Dict with 5 dimension scores (1-10 scale):
            - overall_complexity
            - mathematical_and_logical_reasoning
            - linguistic_and_creative_reasoning
            - factuality
            - chain_of_thought_depth
        """
        system_prompt = self._build_system_prompt(prompt)

        response = self._model(
            system_prompt,
            max_tokens=64,
            temperature=0.1,
            top_k=10,
            repeat_penalty=1.0,
            stop=["\n"]
        )
        response_text = response["choices"][0]["text"]
        scores = self._extract_scores(response_text)

        return scores

    def _build_system_prompt(self, prompt: str) -> str:
        """Build the system prompt for assessment."""
        return f"""Rate this prompt with scores 0-10 (integers). Use these exact keys: overall_complexity, mathematical_and_logical_reasoning, linguistic_and_creative_reasoning, factuality, chain_of_thought_depth. Return valid JSON.

Prompt: {prompt}

{{"overall_complexity":"""

    def _extract_scores(self, response_text: str) -> Dict[str, float]:
        """Extract and validate JSON scores from model response."""
        json_text = '{"overall_complexity":' + response_text
        match = re.search(r'\{[^}]+\}', json_text, re.DOTALL)
        if not match:
            raise ValueError(f"No JSON found in response: {response_text}")

        try:
            scores = json.loads(match.group())
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in response: {response_text}") from e

        required_keys = [
            "overall_complexity",
            "mathematical_and_logical_reasoning",
            "linguistic_and_creative_reasoning",
            "factuality",
            "chain_of_thought_depth"
        ]

        for key in required_keys:
            if key not in scores:
                raise ValueError(f"Missing key '{key}' in scores: {scores}")

            value = scores[key]
            if not isinstance(value, (int, float)):
                raise ValueError(f"Invalid value for '{key}': {value} (must be numeric)")

            if not 0 <= value <= 10:
                raise ValueError(f"Score out of range for '{key}': {value} (must be 0-10)")

        normalized_scores = {}
        for key in required_keys:
            normalized_scores[key] = float(scores[key])

        return normalized_scores


def get_local_router() -> LocalLLMRouter:
    """Get singleton instance of local router."""
    return LocalLLMRouter()
