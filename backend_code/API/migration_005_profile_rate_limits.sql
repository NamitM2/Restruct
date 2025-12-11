-- Migration 005: Add Rate Limiting to Routing Profiles
-- Allows users to set per-profile rate limits

-- Add rate limiting fields to routing_profiles
ALTER TABLE routing_profiles
ADD COLUMN IF NOT EXISTS rate_limit_rpm INTEGER, -- Requests per minute
ADD COLUMN IF NOT EXISTS rate_limit_rph INTEGER, -- Requests per hour
ADD COLUMN IF NOT EXISTS rate_limit_rpd INTEGER; -- Requests per day

-- Comments
COMMENT ON COLUMN routing_profiles.rate_limit_rpm IS 'Max requests per minute for this profile (NULL = no limit)';
COMMENT ON COLUMN routing_profiles.rate_limit_rph IS 'Max requests per hour for this profile (NULL = no limit)';
COMMENT ON COLUMN routing_profiles.rate_limit_rpd IS 'Max requests per day for this profile (NULL = no limit)';

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS profile_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_slug TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Time windows
    minute_window TIMESTAMPTZ NOT NULL,
    hour_window TIMESTAMPTZ NOT NULL,
    day_window TIMESTAMPTZ NOT NULL,

    -- Counters
    requests_this_minute INTEGER DEFAULT 0,
    requests_this_hour INTEGER DEFAULT 0,
    requests_this_day INTEGER DEFAULT 0,

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per profile per user
    UNIQUE(profile_slug, user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profile_rate_limits_lookup
    ON profile_rate_limits(user_id, profile_slug);

-- RLS for rate limits
ALTER TABLE profile_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rate limits" ON profile_rate_limits;

CREATE POLICY "Users can view own rate limits"
    ON profile_rate_limits FOR SELECT
    USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE profile_rate_limits IS 'Tracks rate limit usage per profile';
