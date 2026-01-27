"""
Test streaming responses from the Restruct API with OpenAI SDK.
"""

from openai import OpenAI

# Your API key (starts with rst_)
API_KEY = "rst_oP8zuj2d08yVJXL-kBa0Vq6zZI93cmXpknd1M6XyqjA"

# Create client
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key=API_KEY
)

print("Testing Restruct API Streaming...")
print("=" * 60)

# Make streaming request with Lebron profile
stream = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Say hello!"}],
    extra_body={"restruct": {"profile": "Test"}},
    stream=True
)

# Print chunks as they arrive
print("Response (streaming): ", end="", flush=True)

model_used = None
for chunk in stream:
    # Capture model name from first chunk
    if model_used is None:
        model_used = chunk.model

    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)

print("\n" + "=" * 60)
print(f"Model used: {model_used}")
print("Done!")
