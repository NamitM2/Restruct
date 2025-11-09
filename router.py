"""
Model Router for Restruct
Intelligently selects the best model based on prompt characteristics,
cost, and performance requirements
"""

from typing import Dict, Optional, List
from models_config import get_all_models


class ModelRouter:
    """Routes prompts to the optimal model based on cost and performance"""

    def __init__(self):
        self.models = get_all_models()

    def analyze_prompt(self, prompt: str) -> Dict[str, any]:
        """
        Analyze prompt characteristics to inform routing decision
        Returns metrics about the prompt
        """
        word_count = len(prompt.split())
        char_count = len(prompt)

        # Simple heuristics for prompt complexity
        is_long = word_count > 100
        has_code = any(keyword in prompt.lower() for keyword in ['code', 'function', 'class', 'def', '```'])
        is_creative = any(keyword in prompt.lower() for keyword in ['write', 'story', 'poem', 'creative'])
        is_analytical = any(keyword in prompt.lower() for keyword in ['analyze', 'explain', 'compare', 'evaluate'])

        return {
            "word_count": word_count,
            "char_count": char_count,
            "is_long": is_long,
            "has_code": has_code,
            "is_creative": is_creative,
            "is_analytical": is_analytical
        }

    def calculate_score(
        self,
        model_name: str,
        model_attrs: Dict,
        prompt_analysis: Dict,
        priority: str = "balanced"
    ) -> float:
        """
        Calculate routing score for a model based on prompt and priority

        Args:
            model_name: Name of the model
            model_attrs: Model attributes (cost, performance, etc.)
            prompt_analysis: Analysis of the prompt
            priority: "cost", "performance", or "balanced"

        Returns:
            Score for the model (higher is better)
        """
        cost = model_attrs["cost"]
        performance = model_attrs["performance"]

        # Base score calculation
        if priority == "cost":
            # Prioritize low cost
            score = performance / (cost * 100)  # Normalize cost
        elif priority == "performance":
            # Prioritize high performance
            score = performance * performance / cost
        else:  # balanced
            # Balance cost and performance
            score = performance / cost

        # Apply prompt-specific bonuses
        if prompt_analysis["is_long"] and model_attrs.get("max_tokens", 0) > 100000:
            score *= 1.2  # Bonus for long-context models on long prompts

        if prompt_analysis["is_analytical"] and performance > 0.85:
            score *= 1.1  # Bonus for high-performance models on analytical tasks

        if prompt_analysis["has_code"] and "gpt-4" in model_name.lower():
            score *= 1.15  # Bonus for GPT-4 on code tasks

        if not prompt_analysis["is_long"] and cost < 0.001:
            score *= 1.1  # Bonus for cheap models on simple tasks

        return score

    def route(
        self,
        prompt: str,
        priority: str = "balanced",
        excluded_models: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """
        Select the best model for the given prompt

        Args:
            prompt: User's input prompt
            priority: Routing strategy ("cost", "performance", "balanced")
            excluded_models: List of model names to exclude

        Returns:
            Dictionary with selected model info and routing metadata
        """
        if excluded_models is None:
            excluded_models = []

        # Analyze the prompt
        prompt_analysis = self.analyze_prompt(prompt)

        # Calculate scores for all models
        model_scores = {}
        for model_name, model_attrs in self.models.items():
            if model_name in excluded_models:
                continue

            # Skip models without API keys configured
            if model_attrs["api_key"] in ["your-openai-key", "your-google-key", "your-anthropic-key"]:
                continue

            score = self.calculate_score(
                model_name,
                model_attrs,
                prompt_analysis,
                priority
            )
            model_scores[model_name] = score

        # Select the best model
        if not model_scores:
            # Fallback to first available model if no models pass filters
            available_models = {
                name: attrs for name, attrs in self.models.items()
                if attrs["api_key"] not in ["your-openai-key", "your-google-key", "your-anthropic-key"]
            }
            if available_models:
                best_model = list(available_models.keys())[0]
                best_score = 0
            else:
                raise ValueError("No models available. Please configure API keys.")
        else:
            best_model = max(model_scores, key=model_scores.get)
            best_score = model_scores[best_model]

        # Prepare routing result
        model_info = self.models[best_model]

        return {
            "model": best_model,
            "provider": model_info["provider"],
            "cost": model_info["cost"],
            "performance": model_info["performance"],
            "score": best_score,
            "prompt_analysis": prompt_analysis,
            "routing_strategy": priority,
            "alternatives": sorted(
                [{"model": m, "score": s} for m, s in model_scores.items()],
                key=lambda x: x["score"],
                reverse=True
            )[:3]  # Top 3 alternatives
        }
