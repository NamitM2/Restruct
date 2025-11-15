import atexit
import os
import re
from uuid import uuid4
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

_httpx_client = httpx.Client()
atexit.register(_httpx_client.close)
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_KEY,
    ClientOptions(httpx_client=_httpx_client),
)


def create_conversation(user_id: str, title: str = "New Conversation") -> dict:
    result = supabase.table("conversations").insert({
        "user_id": user_id,
        "title": title
    }).execute()
    return result.data[0]


def get_user_conversations(user_id: str) -> list:
    result = supabase.table("conversations").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return result.data


def get_conversation_messages(conversation_id: str) -> list:
    result = supabase.table("messages").select("*").eq("conversation_id", conversation_id).order("created_at", desc=False).execute()
    return result.data


def add_message(conversation_id: str, role: str, content: str, model: str = None, provider: str = None, profile_name: str = None, metadata: dict = None) -> dict:
    message_data = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content
    }

    if model:
        message_data["model"] = model
    if provider:
        message_data["provider"] = provider
    if profile_name:
        message_data["profile_name"] = profile_name
    if metadata:
        message_data["metadata"] = metadata

    result = supabase.table("messages").insert(message_data).execute()
    return result.data[0]


def update_conversation_title(conversation_id: str, title: str) -> dict:
    result = supabase.table("conversations").update({"title": title}).eq("id", conversation_id).execute()
    return result.data[0]


def delete_conversation(conversation_id: str) -> None:
    supabase.table("conversations").delete().eq("id", conversation_id).execute()


def delete_message(message_id: str) -> None:
    supabase.table("messages").delete().eq("id", message_id).execute()


def slugify_profile_name(name: str) -> str:
    base = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') or 'profile'
    suffix = uuid4().hex[:6]
    return f"{base}-{suffix}"


def create_routing_profile(user_id: str, name: str, description: Optional[str], graph_state: dict) -> dict:
    payload = {
        "user_id": user_id,
        "name": name,
        "description": description,
        "graph_state": graph_state,
        "slug": slugify_profile_name(name)
    }
    result = supabase.table("routing_profiles").insert(payload).execute()
    return result.data[0]


def get_routing_profiles(user_id: str) -> List[dict]:
    result = (
        supabase.table("routing_profiles")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data
