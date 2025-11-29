"""
Embedding utilities.
"""

from openai import OpenAI


def embed_prompt(text: str, model: str = "text-embedding-3-small") -> list:
    """
    Return embedding vector for the given text using OpenAI embeddings.
    Newlines are stripped to avoid unexpected tokenization artifacts.
    """
    client = OpenAI()
    clean_text = (text or "").replace("\n", " ")
    response = client.embeddings.create(input=[clean_text], model=model)
    return response.data[0].embedding
