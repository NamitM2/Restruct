-- ============================================================================
-- COMBINED WALLET SYSTEM MIGRATIONS
-- Run this entire file in your Supabase SQL editor
-- ============================================================================

-- ============================================================================
-- MIGRATION 004: Wallet System and API Usage Tracking
-- ============================================================================

-- User wallet balances
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage logging for cost tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,

    -- Request details
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,

    -- Model and provider info
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    profile_name TEXT,

    -- Token usage
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,

    -- Cost tracking
    estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,

    -- Metadata
    status_code INTEGER,
    error_message TEXT,
    request_duration_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_created ON api_usage(user_id, created_at);

-- RLS policies for user_wallets
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet" ON user_wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON user_wallets;

CREATE POLICY "Users can view own wallet"
    ON user_wallets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
    ON user_wallets FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS policies for api_usage
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON api_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON api_usage;

CREATE POLICY "Users can view own usage"
    ON api_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
    ON api_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to automatically create wallet on user signup
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_wallets (user_id, balance)
    VALUES (NEW.id, 0.0000)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create wallet when new user signs up
DROP TRIGGER IF EXISTS on_user_wallet_created ON auth.users;
CREATE TRIGGER on_user_wallet_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_wallet();

-- Function to update wallet updated_at
CREATE TRIGGER update_user_wallets_updated_at
    BEFORE UPDATE ON user_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_wallets IS 'Prepaid wallet balances for users';
COMMENT ON TABLE api_usage IS 'API usage logs with token and cost tracking';
COMMENT ON COLUMN user_wallets.balance IS 'Current balance in USD';
COMMENT ON COLUMN api_usage.estimated_cost IS 'Estimated cost in USD for this request';

-- ============================================================================
-- MIGRATION 005: Add Rate Limiting to Routing Profiles
-- ============================================================================

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

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if tables were created
SELECT 'user_wallets' as table_name, COUNT(*) as row_count FROM user_wallets
UNION ALL
SELECT 'api_usage', COUNT(*) FROM api_usage
UNION ALL
SELECT 'profile_rate_limits', COUNT(*) FROM profile_rate_limits;

-- Check if routing_profiles has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'routing_profiles'
AND column_name IN ('rate_limit_rpm', 'rate_limit_rph', 'rate_limit_rpd');

-- ============================================================================
-- DONE!
-- ============================================================================
-- If you see no errors above, the migrations completed successfully.
-- Next steps:
-- 1. Restart your backend server
-- 2. Test the wallet functionality
-- 3. See WALLET_SYSTEM_IMPLEMENTATION.md for full guide
-- ============================================================================
