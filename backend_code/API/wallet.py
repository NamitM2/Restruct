import os
from decimal import Decimal
from typing import Dict, Any, Optional

# Development mode flag - set to True to bypass wallet checks
# Development mode flag
DEVELOPMENT_MODE = False
# Demo mode: Free usage with strict limits
# Reads from env var 'DEMO_MODE', defaults to True
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"


# Cost per 1M tokens (in USD) for each provider/model
# These are approximations - update with real pricing
PRICING = {
    "openai": {
        "gpt-5": {"input": 5.00, "output": 15.00},
        "gpt-5-nano": {"input": 0.15, "output": 0.60},
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    },
    "anthropic": {
        "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},
        "claude-3-5-haiku-20241022": {"input": 0.80, "output": 4.00},
    },
    "google": {
        "gemini-1.5-pro-002": {"input": 1.25, "output": 5.00},
        "gemini-1.5-flash-002": {"input": 0.075, "output": 0.30},
    }
}


def calculate_cost(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int
) -> Decimal:
    """
    Calculate the estimated cost for an API request.

    Args:
        provider: Provider name (openai, anthropic, google)
        model: Model name
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Estimated cost in USD
    """
    provider = provider.lower()

    # Get pricing for this provider/model
    if provider not in PRICING:
        # Default fallback pricing
        return Decimal("0.001") * (input_tokens + output_tokens) / 1000

    provider_pricing = PRICING[provider]
    if model not in provider_pricing:
        # Use average pricing for provider
        avg_input = sum(p["input"] for p in provider_pricing.values()) / len(provider_pricing)
        avg_output = sum(p["output"] for p in provider_pricing.values()) / len(provider_pricing)
        input_cost = Decimal(str(avg_input)) * input_tokens / 1_000_000
        output_cost = Decimal(str(avg_output)) * output_tokens / 1_000_000
        return input_cost + output_cost

    model_pricing = provider_pricing[model]
    input_cost = Decimal(str(model_pricing["input"])) * input_tokens / 1_000_000
    output_cost = Decimal(str(model_pricing["output"])) * output_tokens / 1_000_000

    return input_cost + output_cost


async def get_wallet_balance(supabase, user_id: str) -> Decimal:
    """Get current wallet balance for user."""
    result = supabase.table("user_wallets").select("balance").eq("user_id", user_id).execute()

    if not result.data:
        # Create wallet if it doesn't exist
        supabase.table("user_wallets").insert({
            "user_id": user_id,
            "balance": 0.0
        }).execute()
        return Decimal("0.0")

    return Decimal(str(result.data[0]["balance"]))


async def check_sufficient_balance(
    supabase,
    user_id: str,
    estimated_cost: Decimal
) -> bool:
    """
    Check if user has sufficient balance for a request.

    Args:
        supabase: Supabase client
        user_id: User ID
        estimated_cost: Estimated cost of the request

    Returns:
        True if sufficient balance or DEVELOPMENT_MODE is enabled
    """
    if DEVELOPMENT_MODE or DEMO_MODE:
        return True

    balance = await get_wallet_balance(supabase, user_id)
    return balance >= estimated_cost


async def deduct_from_wallet(
    supabase,
    user_id: str,
    amount: Decimal
) -> Dict[str, Any]:
    """
    Deduct amount from user's wallet.

    Args:
        supabase: Supabase client
        user_id: User ID
        amount: Amount to deduct

    Returns:
        Updated wallet info
    """
    if DEVELOPMENT_MODE:
        # In dev mode, just return fake balance
        return {"balance": 999.99, "deducted": float(amount)}

    # Get current balance
    balance = await get_wallet_balance(supabase, user_id)
    new_balance = balance - amount

    # Update wallet
    result = supabase.table("user_wallets").update({
        "balance": float(new_balance)
    }).eq("user_id", user_id).execute()

    return {
        "balance": float(new_balance),
        "deducted": float(amount)
    }


async def log_api_usage(
    supabase,
    user_id: str,
    api_key_id: Optional[str],
    endpoint: str,
    method: str,
    provider: str,
    model: str,
    profile_name: Optional[str],
    input_tokens: int,
    output_tokens: int,
    estimated_cost: Decimal,
    status_code: int,
    error_message: Optional[str] = None,
    request_duration_ms: Optional[int] = None
) -> None:
    """
    Log API usage for tracking and analytics.

    Args:
        supabase: Supabase client
        user_id: User ID
        api_key_id: API key ID (if used)
        endpoint: API endpoint called
        method: HTTP method
        provider: Provider name
        model: Model name
        profile_name: Profile name (if used)
        input_tokens: Input token count
        output_tokens: Output token count
        estimated_cost: Estimated cost
        status_code: HTTP status code
        error_message: Error message (if any)
        request_duration_ms: Request duration in milliseconds
    """
    supabase.table("api_usage").insert({
        "user_id": user_id,
        "api_key_id": api_key_id,
        "endpoint": endpoint,
        "method": method,
        "provider": provider,
        "model": model,
        "profile_name": profile_name,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "estimated_cost": float(estimated_cost),
        "status_code": status_code,
        "error_message": error_message,
        "request_duration_ms": request_duration_ms
    }).execute()


async def add_funds(
    supabase,
    user_id: str,
    amount: Decimal
) -> Dict[str, Any]:
    """
    Add funds to user's wallet.

    Args:
        supabase: Supabase client
        user_id: User ID
        amount: Amount to add

    Returns:
        Updated wallet info
    """
    if DEMO_MODE:
        raise ValueError("Adding funds is disabled in Demo Mode.")

    # Get current balance
    balance = await get_wallet_balance(supabase, user_id)
    new_balance = balance + amount

    # Update wallet
    result = supabase.table("user_wallets").update({
        "balance": float(new_balance)
    }).eq("user_id", user_id).execute()

    return {
        "balance": float(new_balance),
        "added": float(amount)
    }
