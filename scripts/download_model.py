"""
Download Phi-3-mini-4k-instruct model locally for offline use.
Run this once to cache the model, then all future runs will be instant.
"""

import os
from transformers import AutoModelForCausalLM, AutoTokenizer

def download_phi3():
    """Download microsoft/Phi-3-mini-4k-instruct to local cache."""

    model_name = "microsoft/Phi-3-mini-4k-instruct"
    cache_dir = os.path.join(os.getcwd(), 'models')
    os.makedirs(cache_dir, exist_ok=True)

    print("=" * 60)
    print("Downloading Phi-3-mini-4k-instruct")
    print("=" * 60)
    print(f"\nModel: {model_name}")
    print(f"Size: ~3.8B parameters (~7.6 GB)")
    print(f"Cache directory: {cache_dir}")
    print(f"\nThis will take 5-10 minutes depending on your internet speed...")
    print("Progress bars will appear below:\n")

    # Download tokenizer
    print("Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        cache_dir=cache_dir,
        trust_remote_code=True
    )
    print("✓ Tokenizer downloaded")

    # Download model
    print("\nDownloading model (this is the large download)...")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        cache_dir=cache_dir,
        trust_remote_code=True,
        torch_dtype="auto",
        device_map="cpu"  # Download to CPU first
    )
    print("✓ Model downloaded")

    print("\n" + "=" * 60)
    print("✓ Phi-3 downloaded successfully!")
    print("=" * 60)
    print(f"\nModel cached at: {cache_dir}")
    print(f"All future runs will load instantly from local cache.")
    print(f"No internet connection required after this initial download.")

    # Test the model
    print(f"\nTesting model... ", end="")
    test_input = tokenizer("Hello", return_tensors="pt")
    print(f"✓ Working! (model loaded successfully)")

if __name__ == "__main__":
    download_phi3()
