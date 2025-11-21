"""
Embedding-based Routing Experiment.

This script demonstrates routing user prompts to the most suitable LLM based on semantic similarity
between the prompt requirements and the model's capability descriptions.

Dependencies:
    pip install sentence-transformers scikit-learn
"""

import sys
from typing import List, Dict, Any

try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("Missing dependencies. Please run:")
    print("pip install sentence-transformers scikit-learn")
    sys.exit(1)

# Import the central model configuration
import os
import sys
# Add the project root to sys.path so we can import backend_code as a module
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.append(project_root)
try:
    import backend_code.models_config as models_config
    MODELS = models_config.MODELS
except Exception as e:
    print(f"Failed to import MODELS from models_config: {e}")
    sys.exit(1)


class EmbeddingRouter:
    """Simple router that embeds model capability descriptions and prompts.

    It loads an embedding model (preferring the Instructor model, with fallbacks) and
    provides methods to register models and to find the best match for a prompt.
    """

    def __init__(self, model_name: str = "hkunlp/instructor-base"):
        self.model = self._load_model(model_name)
        self.model_embeddings_matrix = None
        self.model_names: List[str] = []
        self.models_data: Dict[str, Dict[str, Any]] = {}

    def _load_model(self, primary_model_name: str):
        """Attempt to load the requested embedding model, falling back if needed."""
        candidates = [
            (primary_model_name, {}),
            ("BAAI/bge-base-en-v1.5", {"use_safetensors": True}),
            ("sentence-transformers/all-MiniLM-L6-v2", {}),
        ]
        for name, kwargs in candidates:
            print(f"Attempting to load embedding model: {name}...")
            try:
                model = SentenceTransformer(name, trust_remote_code=True, model_kwargs=kwargs)
                print(f"SUCCESS: Loaded {name}")
                return model
            except Exception as e:
                print(f"FAILED to load {name}: {e}")
        print("CRITICAL: Could not load any embedding model.")
        sys.exit(1)

    def register_models(self, models: List[Dict[str, Any]]):
        """Register models and compute embeddings for their capability descriptions.

        Args:
            models: List of dicts with keys 'name' and 'capabilities_description'.
        """
        self.models_data = {m["name"]: m for m in models}
        descriptions = [m["capabilities_description"] for m in models]
        print("Generating embeddings for model capabilities...")
        # encode with convert_to_numpy for efficient cosine similarity
        self.model_embeddings_matrix = self.model.encode(descriptions, convert_to_numpy=True)
        self.model_names = [m["name"] for m in models]

    def route(self, prompt: str, top_k: int = 1) -> List[Dict[str, Any]]:
        """Return the top_k models most similar to the prompt.

        Args:
            prompt: User prompt string.
            top_k: Number of top models to return.
        """
        prompt_emb = self.model.encode([prompt], convert_to_numpy=True)
        similarities = cosine_similarity(prompt_emb, self.model_embeddings_matrix)[0]
        scored = [(self.model_names[i], float(similarities[i])) for i in range(len(self.model_names))]
        scored.sort(key=lambda x: x[1], reverse=True)
        results = []
        for name, score in scored[:top_k]:
            results.append({
                "model": name,
                "score": score,
                "description": self.models_data[name]["capabilities_description"],
            })
        return results


def build_available_models() -> List[Dict[str, Any]]:
    """Construct a list of models with human‑readable names and a short description.

    The description is built from the capability_attributes defined in models_config.
    """
    available = []
    for provider, cfg in MODELS.items():
        api_key = cfg.get("api_key")  # not used here but kept for completeness
        for model_name, model_cfg in cfg.get("models", {}).items():
            attrs = model_cfg.get("capability_attributes", {})

            # Build natural language description based on strengths
            description_parts = []

            # Overall complexity
            complexity = attrs.get("overall_complexity", 0)
            if complexity >= 8:
                description_parts.append("Handles highly complex and sophisticated tasks")
            elif complexity >= 6:
                description_parts.append("Suitable for moderately complex tasks")
            else:
                description_parts.append("Best for simple, straightforward tasks")

            # Mathematical reasoning
            math = attrs.get("mathematical_and_logical_reasoning", 0)
            if math >= 8:
                description_parts.append("excels at advanced mathematics, logic, and quantitative analysis")
            elif math >= 5:
                description_parts.append("capable of moderate mathematical and logical reasoning")
            elif math >= 2:
                description_parts.append("handles basic arithmetic and simple logic")

            # Linguistic/creative
            linguistic = attrs.get("linguistic_and_creative_reasoning", 0)
            if linguistic >= 8:
                description_parts.append("exceptional creative writing, poetry, and nuanced language understanding")
            elif linguistic >= 5:
                description_parts.append("good at creative tasks and linguistic analysis")
            elif linguistic >= 2:
                description_parts.append("basic language understanding")

            # Factuality
            factuality = attrs.get("factuality", 0)
            if factuality >= 8:
                description_parts.append("highly accurate factual recall and knowledge retrieval")
            elif factuality >= 5:
                description_parts.append("reliable for general knowledge queries")

            # Chain of thought
            cot = attrs.get("chain_of_thought_depth", 0)
            if cot >= 8:
                description_parts.append("deep multi-step reasoning and complex problem decomposition")
            elif cot >= 5:
                description_parts.append("moderate step-by-step reasoning ability")

            description = ". ".join(description_parts) + "."
            full_name = f"{provider}:{model_name}"
            available.append({"name": full_name, "capabilities_description": description})
    return available


def run_experiment():
    available_models = build_available_models()
    router = EmbeddingRouter()
    router.register_models(available_models)

    test_prompts = [
        "Calculate the trajectory of a rocket given specific thrust and atmospheric drag coefficients, showing all differential equations.",
        "Write a sonnet about a robot falling in love with a toaster in the style of Shakespeare.",
        "Summarize this short email: 'Hi, I'll be late today. See you at 10.'",
        "Write a Python function to reverse a string using recursion.",
        "Analyze this 500-page legal document and extract all liability clauses.",
        "Classify this sentiment: 'I loved the movie!'",
    ]

    print("\n" + "=" * 60)
    print("RUNNING ROUTING EXPERIMENT")
    print("=" * 60 + "\n")

    for prompt in test_prompts:
        print(f"PROMPT: {prompt}")
        results = router.route(prompt, top_k=2)
        for i, res in enumerate(results):
            print(f"  Rank {i+1}: {res['model']} (Score: {res['score']:.4f})")
        print("-" * 40)

if __name__ == "__main__":
    run_experiment()
