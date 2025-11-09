"""
Database Module for Restruct
Handles Supabase interactions for storing prompts, responses, and metadata
"""

import os
from typing import Dict, Optional, List
from datetime import datetime


class Database:
    """Manages database operations with Supabase"""

    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_KEY")
        self.client = None

    def _get_client(self):
        """Lazy initialization of Supabase client"""
        if self.client is None:
            try:
                from supabase import create_client, Client
                if not self.supabase_url or not self.supabase_key:
                    print("Warning: Supabase credentials not configured. Database features disabled.")
                    return None
                self.client = create_client(self.supabase_url, self.supabase_key)
            except ImportError:
                print("Warning: Supabase package not installed. Run: pip install supabase")
                return None
        return self.client

    async def save_interaction(
        self,
        prompt: str,
        model: str,
        provider: str,
        output: str,
        routing_metadata: Dict,
        usage: Dict,
        user_id: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Save a chat interaction to the database

        Args:
            prompt: User's input prompt
            model: Model that was used
            provider: Provider name
            output: Model's response
            routing_metadata: Metadata from the router
            usage: Token usage information
            user_id: Optional user identifier

        Returns:
            Saved record or None if database not configured
        """
        client = self._get_client()
        if not client:
            return None

        try:
            data = {
                "prompt": prompt,
                "model": model,
                "provider": provider,
                "output": output,
                "routing_metadata": routing_metadata,
                "usage": usage,
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            }

            response = client.table("interactions").insert(data).execute()
            return response.data[0] if response.data else None

        except Exception as e:
            print(f"Database error: {str(e)}")
            return None

    async def get_user_history(
        self,
        user_id: str,
        limit: int = 50
    ) -> List[Dict]:
        """
        Retrieve chat history for a user

        Args:
            user_id: User identifier
            limit: Maximum number of records to retrieve

        Returns:
            List of interaction records
        """
        client = self._get_client()
        if not client:
            return []

        try:
            response = (
                client.table("interactions")
                .select("*")
                .eq("user_id", user_id)
                .order("timestamp", desc=True)
                .limit(limit)
                .execute()
            )
            return response.data if response.data else []

        except Exception as e:
            print(f"Database error: {str(e)}")
            return []

    async def get_model_stats(
        self,
        days: int = 30
    ) -> Dict[str, any]:
        """
        Get statistics about model usage

        Args:
            days: Number of days to look back

        Returns:
            Dictionary with model usage statistics
        """
        client = self._get_client()
        if not client:
            return {}

        try:
            # This is a placeholder - actual implementation would use
            # Supabase functions or aggregation queries
            response = client.table("interactions").select("model").execute()

            if not response.data:
                return {}

            # Count model usage
            model_counts = {}
            for record in response.data:
                model = record.get("model")
                model_counts[model] = model_counts.get(model, 0) + 1

            return {
                "model_usage": model_counts,
                "total_interactions": len(response.data)
            }

        except Exception as e:
            print(f"Database error: {str(e)}")
            return {}

    async def save_api_key(
        self,
        user_id: str,
        provider: str,
        api_key: str
    ) -> Optional[Dict]:
        """
        Save encrypted API key for a user

        Args:
            user_id: User identifier
            provider: Provider name
            api_key: API key (should be encrypted in production)

        Returns:
            Saved record or None
        """
        client = self._get_client()
        if not client:
            return None

        try:
            data = {
                "user_id": user_id,
                "provider": provider,
                "api_key": api_key,  # In production, encrypt this!
                "updated_at": datetime.utcnow().isoformat()
            }

            response = (
                client.table("api_keys")
                .upsert(data, on_conflict="user_id,provider")
                .execute()
            )
            return response.data[0] if response.data else None

        except Exception as e:
            print(f"Database error: {str(e)}")
            return None

    async def get_api_key(
        self,
        user_id: str,
        provider: str
    ) -> Optional[str]:
        """
        Retrieve API key for a user and provider

        Args:
            user_id: User identifier
            provider: Provider name

        Returns:
            API key or None
        """
        client = self._get_client()
        if not client:
            return None

        try:
            response = (
                client.table("api_keys")
                .select("api_key")
                .eq("user_id", user_id)
                .eq("provider", provider)
                .execute()
            )

            if response.data:
                return response.data[0]["api_key"]
            return None

        except Exception as e:
            print(f"Database error: {str(e)}")
            return None
