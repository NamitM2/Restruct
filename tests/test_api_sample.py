"""
Quick test of the Restruct API with OpenAI SDK.
"""

from openai import OpenAI

# Your API key (starts with rst_)
API_KEY = "rst_oYVXpEl6jw45n8COI7d8sMDcRxSCOJHwPu2xx56GZbc"

# Create client
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key=API_KEY
)

print("Testing Restruct API...")
print("=" * 60)

# Make request with Lebron profile (using name instead of slug)
response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
    extra_body={"restruct": {"profile": "Lebron"}}
)

# Print results
print(f"Response: {response.choices[0].message.content}")
print(f"\nModel: {response.model}")
print(f"Provider: {response.restruct['provider']}")
print(f"Profile: {response.restruct.get('profile_used', 'N/A')}")
print(f"Tokens: {response.usage.prompt_tokens} in, {response.usage.completion_tokens} out")
print("=" * 60)
print("Success! ✓")
