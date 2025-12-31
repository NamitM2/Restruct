-- Migration 007: Per-Key Rate Limits and Metadata
-- Run this in your Supabase SQL editor

-- Add rate limit columns to api_keys table
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_rpm INTEGER;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_rph INTEGER;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rate_limit_rpd INTEGER;

-- Add metadata columns
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS environment TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS application TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create table for tracking per-key rate limits
CREATE TABLE IF NOT EXISTS api_key_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    window_type TEXT NOT NULL CHECK (window_type IN ('minute', 'hour', 'day')),
    request_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(api_key_id, window_start, window_type)
);

-- Indexes for fast rate limit checks
CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_key_window ON api_key_rate_limits(api_key_id, window_start, window_type);
CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_window_start ON api_key_rate_limits(window_start);

-- RLS policies for api_key_rate_limits
ALTER TABLE api_key_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own key rate limits" ON api_key_rate_limits;
CREATE POLICY "Users can view own key rate limits"
    ON api_key_rate_limits FOR SELECT
    USING (
        api_key_id IN (
            SELECT id FROM api_keys WHERE user_id = auth.uid()
        )
    );

-- Service role can manage rate limits (for backend)
DROP POLICY IF EXISTS "Service can manage rate limits" ON api_key_rate_limits;
CREATE POLICY "Service can manage rate limits"
    ON api_key_rate_limits FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add index on api_usage for per-key analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_key_id_created ON api_usage(api_key_id, created_at DESC) WHERE api_key_id IS NOT NULL;

-- Function to clean up old rate limit windows (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_windows()
RETURNS void AS $$
BEGIN
    DELETE FROM api_key_rate_limits
    WHERE window_start < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN api_keys.rate_limit_rpm IS 'Requests per minute limit for this API key';
COMMENT ON COLUMN api_keys.rate_limit_rph IS 'Requests per hour limit for this API key';
COMMENT ON COLUMN api_keys.rate_limit_rpd IS 'Requests per day limit for this API key';
COMMENT ON COLUMN api_keys.environment IS 'Environment tag (e.g., production, staging, development)';
COMMENT ON COLUMN api_keys.application IS 'Application name using this key';
COMMENT ON COLUMN api_keys.tags IS 'JSON array of tags for organizing keys';
COMMENT ON COLUMN api_keys.notes IS 'Notes about this API key';

COMMENT ON TABLE api_key_rate_limits IS 'Tracks request counts per API key for rate limiting';
