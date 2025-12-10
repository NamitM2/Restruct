"""
Test streaming responses from the Restruct API with OpenAI SDK.
"""

from openai import OpenAI

# Your API key (starts with rst_)
API_KEY = "rst_oYVXpEl6jw45n8COI7d8sMDcRxSCOJHwPu2xx56GZbc"

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
    messages=[{"role": "user", "content": "Count from 1 to 10"}],
    extra_body={"restruct": {"profile": "Lebron"}},
    stream=True
)

# Print chunks as they arrive
print("Response (streaming): ", end="", flush=True)
full_response = ""

for chunk in stream:
    if chunk.choices[0].delta.content:
        content = chunk.choices[0].delta.content
        print(content, end="", flush=True)
        full_response += content

print("\n")
print("=" * 60)
print("Streaming test completed! ✓")
