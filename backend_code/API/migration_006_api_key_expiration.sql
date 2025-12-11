-- Migration 006: Add expiration to API keys

-- Add expires_at column
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Comment
COMMENT ON COLUMN api_keys.expires_at IS 'Expiration timestamp for the API key (NULL = never expires)';

-- Function to check if API key is expired
CREATE OR REPLACE FUNCTION is_api_key_expired(key_row api_keys)
RETURNS BOOLEAN AS $$
BEGIN
    IF key_row.expires_at IS NULL THEN
        RETURN FALSE;  -- Never expires
    END IF;
    RETURN NOW() > key_row.expires_at;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add check constraint to prevent creating already-expired keys
ALTER TABLE api_keys
DROP CONSTRAINT IF EXISTS check_expires_at_future;

ALTER TABLE api_keys
ADD CONSTRAINT check_expires_at_future
CHECK (expires_at IS NULL OR expires_at > created_at);

COMMENT ON CONSTRAINT check_expires_at_future ON api_keys IS 'Ensures expiration date is in the future when creating a key';
