"""Test script to measure local LLM router performance."""

import time
from backend_code.local_llm_router import get_local_router

# Test prompts of varying complexity
test_prompts = [
    "Hello",
    "What is 2+2?",
    "Explain quantum entanglement in simple terms",
    "Write a Python function to calculate fibonacci numbers",
    "Compare and contrast the economic policies of Keynesian and Austrian schools of thought"
]

print("Initializing router (this includes model loading time)...")
start_init = time.time()
router = get_local_router()
init_time = (time.time() - start_init) * 1000
print(f"Router initialized in {init_time:.2f}ms\n")

print("Running routing tests...\n")
print("-" * 80)

all_times = []

for i, prompt in enumerate(test_prompts, 1):
    print(f"\nTest {i}: {prompt[:50]}{'...' if len(prompt) > 50 else ''}")

    start = time.time()
    scores = router.assess_prompt(prompt)
    elapsed = (time.time() - start) * 1000
    all_times.append(elapsed)

    print(f"Time: {elapsed:.2f}ms")
    print(f"Scores: {scores}")

print("\n" + "=" * 80)
print("PERFORMANCE SUMMARY")
print("=" * 80)
print(f"Average routing time: {sum(all_times) / len(all_times):.2f}ms")
print(f"Fastest routing time: {min(all_times):.2f}ms")
print(f"Slowest routing time: {max(all_times):.2f}ms")
print(f"Total tests: {len(all_times)}")
