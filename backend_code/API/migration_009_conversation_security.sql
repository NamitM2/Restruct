-- Migration 009: Conversation Sharing Security
-- Adds token expiration, participant limits, rate limiting, and audit logging

-- 1. Add security fields to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_max_participants INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS share_join_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_require_approval BOOLEAN DEFAULT FALSE;

-- 2. Share token usage tracking
CREATE TABLE IF NOT EXISTS share_token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL,
    joined_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    join_ip TEXT,
    join_user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_token_usage_conversation ON share_token_usage(conversation_id);
CREATE INDEX IF NOT EXISTS idx_share_token_usage_user ON share_token_usage(joined_user_id);
CREATE INDEX IF NOT EXISTS idx_share_token_usage_token ON share_token_usage(share_token);

-- 3. Participant rate limiting table
CREATE TABLE IF NOT EXISTS participant_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    minute_window TIMESTAMPTZ NOT NULL,
    hour_window TIMESTAMPTZ NOT NULL,
    day_window TIMESTAMPTZ NOT NULL,
    requests_this_minute INTEGER DEFAULT 0,
    requests_this_hour INTEGER DEFAULT 0,
    requests_this_day INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_rate_limits_conversation ON participant_rate_limits(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participant_rate_limits_user ON participant_rate_limits(user_id);

-- 4. Conversation-wide rate limiting table
CREATE TABLE IF NOT EXISTS conversation_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE UNIQUE,
    minute_window TIMESTAMPTZ NOT NULL,
    hour_window TIMESTAMPTZ NOT NULL,
    requests_this_minute INTEGER DEFAULT 0,
    requests_this_hour INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_rate_limits_conversation ON conversation_rate_limits(conversation_id);

-- 5. Audit log for participant actions
CREATE TABLE IF NOT EXISTS conversation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,  -- 'join', 'leave', 'message_sent', 'permission_changed', 'removed', 'paused', 'unpaused'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_audit_log_conversation ON conversation_audit_log(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_audit_log_user ON conversation_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_audit_log_created ON conversation_audit_log(created_at);

-- 6. Abuse detection tracking
CREATE TABLE IF NOT EXISTS participant_abuse_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    flag_reason TEXT NOT NULL,  -- 'spam', 'rapid_messages', 'long_messages', 'cost_spike'
    flag_count INTEGER DEFAULT 1,
    first_flagged_at TIMESTAMPTZ DEFAULT NOW(),
    last_flagged_at TIMESTAMPTZ DEFAULT NOW(),
    is_blocked BOOLEAN DEFAULT FALSE,
    UNIQUE(conversation_id, user_id, flag_reason)
);

CREATE INDEX IF NOT EXISTS idx_participant_abuse_flags_conversation ON participant_abuse_flags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participant_abuse_flags_user ON participant_abuse_flags(user_id);

-- 7. Add paused state to participants
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blocked_for_abuse BOOLEAN DEFAULT FALSE;

-- 8. Row Level Security for new tables

-- Share token usage: Only conversation owner can view
DROP POLICY IF EXISTS "Owners can view share token usage" ON share_token_usage;
CREATE POLICY "Owners can view share token usage" ON share_token_usage
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Share token usage: System can insert
DROP POLICY IF EXISTS "System can insert share token usage" ON share_token_usage;
CREATE POLICY "System can insert share token usage" ON share_token_usage
    FOR INSERT
    WITH CHECK (true);

-- Audit log: Conversation owner and participants can view their actions
DROP POLICY IF EXISTS "Users can view relevant audit logs" ON conversation_audit_log;
CREATE POLICY "Users can view relevant audit logs" ON conversation_audit_log
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Audit log: System can insert
DROP POLICY IF EXISTS "System can insert audit logs" ON conversation_audit_log;
CREATE POLICY "System can insert audit logs" ON conversation_audit_log
    FOR INSERT
    WITH CHECK (true);

-- Abuse flags: Only conversation owner can view
DROP POLICY IF EXISTS "Owners can view abuse flags" ON participant_abuse_flags;
CREATE POLICY "Owners can view abuse flags" ON participant_abuse_flags
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Abuse flags: System can manage
DROP POLICY IF EXISTS "System can manage abuse flags" ON participant_abuse_flags;
CREATE POLICY "System can manage abuse flags" ON participant_abuse_flags
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Rate limits: System managed (no direct user access)
DROP POLICY IF EXISTS "System manages participant rate limits" ON participant_rate_limits;
CREATE POLICY "System manages participant rate limits" ON participant_rate_limits
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "System manages conversation rate limits" ON conversation_rate_limits;
CREATE POLICY "System manages conversation rate limits" ON conversation_rate_limits
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 9. Function to check if share token is valid
CREATE OR REPLACE FUNCTION is_share_token_valid(token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    conv RECORD;
BEGIN
    SELECT * INTO conv FROM conversations
    WHERE share_token = token
    AND is_shared = TRUE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check expiration
    IF conv.share_expires_at IS NOT NULL THEN
        IF NOW() > conv.share_expires_at THEN
            RETURN FALSE;
        END IF;
    END IF;

    -- Check participant limit
    IF conv.share_max_participants IS NOT NULL THEN
        DECLARE
            participant_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO participant_count
            FROM conversation_participants
            WHERE conversation_id = conv.id
            AND is_active = TRUE;

            IF participant_count >= conv.share_max_participants THEN
                RETURN FALSE;
            END IF;
        END;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 10. Function to log audit events
CREATE OR REPLACE FUNCTION log_conversation_audit(
    p_conversation_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO conversation_audit_log (conversation_id, user_id, action, metadata)
    VALUES (p_conversation_id, p_user_id, p_action, p_metadata);
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger to log participant joins
CREATE OR REPLACE FUNCTION trigger_log_participant_join()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM log_conversation_audit(
        NEW.conversation_id,
        NEW.user_id,
        'join',
        jsonb_build_object('permission', NEW.permission)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_participant_join ON conversation_participants;
CREATE TRIGGER log_participant_join
    AFTER INSERT ON conversation_participants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_log_participant_join();

-- 12. Trigger to log participant removals
CREATE OR REPLACE FUNCTION trigger_log_participant_removal()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        PERFORM log_conversation_audit(
            NEW.conversation_id,
            NEW.user_id,
            'deactivated',
            jsonb_build_object('was_paused', NEW.paused_at IS NOT NULL)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_participant_removal ON conversation_participants;
CREATE TRIGGER log_participant_removal
    AFTER UPDATE ON conversation_participants
    FOR EACH ROW
    WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION trigger_log_participant_removal();

-- 13. Clean up old rate limit windows (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_windows()
RETURNS VOID AS $$
BEGIN
    -- Clean participant rate limits older than 24 hours
    DELETE FROM participant_rate_limits
    WHERE updated_at < NOW() - INTERVAL '24 hours';

    -- Clean conversation rate limits older than 1 hour
    DELETE FROM conversation_rate_limits
    WHERE updated_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 14. Enable RLS on all new tables
ALTER TABLE share_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_abuse_flags ENABLE ROW LEVEL SECURITY;

-- Migration complete
