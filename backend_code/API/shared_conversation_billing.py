"""
Billing enforcement for shared conversations.
"""

import asyncio
from decimal import Decimal
from typing import Dict, Any
from .wallet import get_wallet_balance


async def determine_billing_user(
    supabase,
    conversation_id: str,
    requesting_user_id: str
) -> Dict[str, Any]:
    """
    Determine who should be billed for a message in a shared conversation.

    Args:
        supabase: Supabase client
        conversation_id: Conversation ID
        requesting_user_id: User ID making the request

    Returns:
        {
            "billing_user_id": str,
            "billing_mode": "owner" | "individual",
            "is_owner": bool,
            "owner_id": str
        }

    Raises:
        Exception if conversation not found
    """

    def _determine():
        # Get conversation
        conv = supabase.table("conversations").select(
            "id, user_id, share_billing"
        ).eq("id", conversation_id).execute()

        if not conv.data:
            raise Exception("Conversation not found")

        conversation = conv.data[0]
        owner_id = conversation["user_id"]
        billing_mode = conversation.get("share_billing", "owner")

        is_owner = owner_id == requesting_user_id

        if billing_mode == "owner":
            # Owner pays for all messages
            return {
                "billing_user_id": owner_id,
                "billing_mode": "owner",
                "is_owner": is_owner,
                "owner_id": owner_id
            }
        else:
            # Individual pays for their own messages
            return {
                "billing_user_id": requesting_user_id,
                "billing_mode": "individual",
                "is_owner": is_owner,
                "owner_id": owner_id
            }

    return await asyncio.to_thread(_determine)


async def validate_participant_can_pay(
    supabase,
    user_id: str,
    estimated_cost: Decimal
) -> bool:
    """
    For individual billing mode, verify participant has sufficient funds.

    Args:
        supabase: Supabase client
        user_id: User ID
        estimated_cost: Estimated cost of the request

    Returns:
        True if user has sufficient balance
    """
    balance = await get_wallet_balance(supabase, user_id)
    return balance >= estimated_cost


async def get_conversation_billing_mode(
    supabase,
    conversation_id: str
) -> str:
    """
    Get the billing mode for a conversation.

    Args:
        supabase: Supabase client
        conversation_id: Conversation ID

    Returns:
        "owner" or "individual"
    """

    def _get():
        conv = supabase.table("conversations").select("share_billing").eq(
            "id", conversation_id
        ).execute()

        if not conv.data:
            return "owner"  # Default

        return conv.data[0].get("share_billing", "owner")

    return await asyncio.to_thread(_get)
