-- Migration 007: Add INSERT policy for api_usage table

-- Allow users to insert their own API usage records
DROP POLICY IF EXISTS "Users can insert own usage" ON api_usage;

CREATE POLICY "Users can insert own usage"
    ON api_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can insert own usage" ON api_usage IS 'Allows backend to log API usage for authenticated users';
