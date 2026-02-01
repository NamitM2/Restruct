import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("Error: GOOGLE_API_KEY not found in environment.")
    exit(1)

print(f"Using API Key: {api_key[:5]}...{api_key[-5:]}")

genai.configure(api_key=api_key)

# Test with the requested model (which might not exist)
model_name = "gemini-2.5-flash" 
print(f"Attempting to connect to model: {model_name}")

try:
    model = genai.GenerativeModel(model_name)
    response = model.generate_content("Hi")
    print("\nResponse received:")
    print(response.text)
except Exception as e:
    print(f"\nError occurred with {model_name}:")
    print(e)
    
# Fallback to investigating if it works with a known valid model
print("\n--- INVESITGATION: Trying fallback to gemini-1.5-flash ---")
try:
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content("Hi")
    print(f"Response from gemini-1.5-flash:\n{response.text}")
    print("\nConclusion: API Key is valid. The issue was likely the model name 'gemini-2.5-flash'.")
except Exception as e:
    print(f"Error with fallback gemini-1.5-flash: {e}")
    print("\nConclusion: API Key might be invalid or there is a connection issue.")
