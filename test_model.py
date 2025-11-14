"""
Temporary test script to verify Phi-3-mini-4k-instruct model works.
This file will be deleted after testing.
"""

import time
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

MODEL_PATH = "models/models--microsoft--Phi-3-mini-4k-instruct/snapshots/0a67737cc96d2554230f90338b163bc6380a2a85"

print("=" * 60)
print("  Phi-3 Model Test")
print("=" * 60)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"\nDevice: {device}")
if device == "cuda":
    print(f"GPU: {torch.cuda.get_device_name(0)}")

print(f"\nLoading model from: {MODEL_PATH}")
print("This may take a moment...\n")

load_start = time.time()
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, trust_remote_code=True, device_map="auto", torch_dtype=torch.float16)
load_time = time.time() - load_start

print(f"[OK] Model loaded in {load_time:.2f} seconds")
print("\n" + "-" * 60)
print("Running test prompt...")
print("-" * 60 + "\n")

prompt = "What is the capital of France?"
print(f"Prompt: {prompt}\n")

inference_start = time.time()
inputs = tokenizer(prompt, return_tensors="pt").to(device)
outputs = model.generate(**inputs, max_new_tokens=50, use_cache=False)
response = tokenizer.decode(outputs[0], skip_special_tokens=True)
inference_time = time.time() - inference_start

print(f"Response: {response}\n")
print("-" * 60)
print(f"Inference time: {inference_time:.2f} seconds")
print("=" * 60)
