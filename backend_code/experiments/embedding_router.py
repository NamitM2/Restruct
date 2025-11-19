"""
Embedding-based Routing Experiment.

This script tests using an instruction-tuned embedding model (Instructor)
to route prompts to the most suitable LLM based on semantic similarity
between the prompt's requirements and the model's capabilities.

Dependencies:
    pip install sentence-transformers scikit-learn
"""

import numpy as np
from typing import List, Dict, Any
import json

try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("Missing dependencies. Please run:")
    print("pip install sentence-transformers scikit-learn")
    exit(1)


class EmbeddingRouter:
    def __init__(self, model_name: str = "hkunlp/instructor-base"):
        print(f"Loading embedding model: {model_name}...")
        try:
            # trust_remote_code might be needed for some models
            self.model = SentenceTransformer(model_name, trust_remote_code=True)
        except Exception as e:
            print(f"Failed to load {model_name}: {e}")
            print("Falling back to 'all-MiniLM-L6-v2' (standard model, no instructions)")
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            
        self.model_embeddings = {}
        self.models_data = {}
        print("Embedding model loaded.")

    def register_models(self, models: List[Dict[str, Any]]):
        """
        Register LLMs with their capability descriptions.
        
        Args:
            models: List of dicts containing 'name' and 'capabilities_description'.
        """
        self.models_data = {m["name"]: m for m in models}
        
        # We embed the model descriptions.
        # Instruction: Represent the technical capabilities of this Large Language Model:
        descriptions = [
            ["Represent the technical capabilities of this Large Language Model:", m["capabilities_description"]] 
            for m in models
        ]
        
        print("Generating embeddings for models...")
        embeddings = self.model.encode(descriptions)
        
        for i, model in enumerate(models):
            self.model_embeddings[model["name"]] = embeddings[i]
            
    def route(self, prompt: str, top_k: int = 1) -> List[Dict[str, Any]]:
        """
        Find the best model for the given prompt.
        
        Args:
            prompt: The user's prompt.
            top_k: Number of top models to return.
        """
        # Instruction: Represent the requirements to answer this prompt:
        query = [["Represent the requirements to answer this prompt:", prompt]]
        
        prompt_embedding = self.model.encode(query)
        
        scores = {}
        for name, embedding in self.model_embeddings.items():
            # Reshape for sklearn (1, -1)
            similarity = cosine_similarity(
                prompt_embedding.reshape(1, -1), 
                embedding.reshape(1, -1)
            )[0][0]
            scores[name] = float(similarity)
            
        # Sort by score descending
        sorted_models = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        results = []
        for name, score in sorted_models[:top_k]:
            results.append({
                "model": name,
                "score": score,
                "description": self.models_data[name]["capabilities_description"]
            })
            
        return results


def run_experiment():
    # 1. Define our available models and their capabilities
    # We describe them by what they are GOOD at.
    available_models = [
        {
            "name": "GPT-5 (High Cost)",
            "capabilities_description": "Extremely high reasoning, complex math, advanced coding, nuance, creative writing, and deep chain of thought. Best for critical tasks where accuracy is paramount. Expensive."
        },
        {
            "name": "Claude 3 Opus (High Cost)",
            "capabilities_description": "Superior creative writing, long context understanding, nuanced analysis, and high-level reasoning. Very good at following complex instructions. Expensive."
        },
        {
            "name": "Gemini 2.5 Flash (Low Cost)",
            "capabilities_description": "Fast, efficient, good for general tasks, summarization, and simple queries. Low latency and low cost. Not suitable for complex math or deep reasoning."
        },
        {
            "name": "Phi-3.5 Mini (Local/Free)",
            "capabilities_description": "Offline, privacy-focused, good for basic coding and reasoning. Zero cost. Limited knowledge base compared to larger models."
        },
        {
            "name": "GPT-5 Mini (Medium Cost)",
            "capabilities_description": "Balanced performance for standard tasks. Good at logic and coding but faster and cheaper than the full model."
        }
    ]

    # 2. Initialize Router
    router = EmbeddingRouter(model_name="hkunlp/instructor-base")
    router.register_models(available_models)

    # 3. Test Prompts
    test_prompts = [
        "Calculate the trajectory of a rocket given specific thrust and atmospheric drag coefficients, showing all differential equations.",
        "Write a poem about a robot falling in love with a toaster in the style of Shakespeare.",
        "Summarize this short email: 'Hi, I'll be late today. See you at 10.'",
        "Write a Python function to reverse a string.",
        "Explain the socio-economic impact of the industrial revolution in 3 sentences."
    ]

    print("\n" + "="*50)
    print("RUNNING ROUTING EXPERIMENT")
    print("="*50 + "\n")

    for prompt in test_prompts:
        print(f"PROMPT: {prompt}")
        results = router.route(prompt, top_k=2)
        for i, res in enumerate(results):
            print(f"  Rank {i+1}: {res['model']} (Score: {res['score']:.4f})")
        print("-" * 30)

if __name__ == "__main__":
    run_experiment()
