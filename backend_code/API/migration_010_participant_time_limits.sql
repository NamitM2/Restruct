-- Migration 010: Participant Time Limits
-- Add time limits for how long participants can chat in shared conversations

-- 1. Add participant access duration fields to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS participant_access_duration TEXT DEFAULT 'forever'
    CHECK (participant_access_duration IN ('1h', '24h', '7d', 'forever', 'custom')),
ADD COLUMN IF NOT EXISTS participant_access_hours INTEGER;

COMMENT ON COLUMN conversations.participant_access_duration IS 'How long participants can chat: 1h, 24h, 7d, forever, or custom';
COMMENT ON COLUMN conversations.participant_access_hours IS 'For custom duration: number of hours participants can chat';

-- 2. Add access expiration tracking to participants table
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN conversation_participants.access_expires_at IS 'When this participant loses chat access (null = never expires)';

-- 3. Index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_participants_access_expires
ON conversation_participants(access_expires_at)
WHERE access_expires_at IS NOT NULL;

-- 4. Function to check if participant access has expired
CREATE OR REPLACE FUNCTION is_participant_access_valid(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    participant RECORD;
BEGIN
    SELECT * INTO participant
    FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id
    AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- If no expiration set, access is valid
    IF participant.access_expires_at IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check if expired
    IF NOW() > participant.access_expires_at THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to calculate participant access expiration
CREATE OR REPLACE FUNCTION calculate_participant_access_expiration(
    p_access_duration TEXT,
    p_custom_hours INTEGER,
    p_joined_at TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    IF p_access_duration = 'forever' THEN
        RETURN NULL;
    ELSIF p_access_duration = '1h' THEN
        RETURN p_joined_at + INTERVAL '1 hour';
    ELSIF p_access_duration = '24h' THEN
        RETURN p_joined_at + INTERVAL '24 hours';
    ELSIF p_access_duration = '7d' THEN
        RETURN p_joined_at + INTERVAL '7 days';
    ELSIF p_access_duration = 'custom' AND p_custom_hours IS NOT NULL THEN
        RETURN p_joined_at + (p_custom_hours || ' hours')::INTERVAL;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to set participant access expiration on join
CREATE OR REPLACE FUNCTION trigger_set_participant_access_expiration()
RETURNS TRIGGER AS $$
DECLARE
    conv RECORD;
    expires_at TIMESTAMPTZ;
BEGIN
    -- Get conversation access settings
    SELECT participant_access_duration, participant_access_hours
    INTO conv
    FROM conversations
    WHERE id = NEW.conversation_id;

    -- Calculate expiration
    expires_at := calculate_participant_access_expiration(
        conv.participant_access_duration,
        conv.participant_access_hours,
        NEW.joined_at
    );

    -- Set expiration
    NEW.access_expires_at := expires_at;

    -- Log if expiration is set
    IF expires_at IS NOT NULL THEN
        PERFORM log_conversation_audit(
            NEW.conversation_id,
            NEW.user_id,
            'access_granted_with_expiration',
            jsonb_build_object(
                'expires_at', expires_at,
                'duration', conv.participant_access_duration
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_participant_access_expiration ON conversation_participants;
CREATE TRIGGER set_participant_access_expiration
    BEFORE INSERT ON conversation_participants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_participant_access_expiration();

-- 7. Trigger to log when participant access expires
CREATE OR REPLACE FUNCTION trigger_log_participant_access_expiration()
RETURNS TRIGGER AS $$
BEGIN
    -- When is_active changes from true to false due to expiration
    IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        IF NEW.access_expires_at IS NOT NULL AND NOW() > NEW.access_expires_at THEN
            PERFORM log_conversation_audit(
                NEW.conversation_id,
                NEW.user_id,
                'access_expired',
                jsonb_build_object(
                    'expired_at', NEW.access_expires_at,
                    'deactivated_at', NOW()
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_participant_access_expiration ON conversation_participants;
CREATE TRIGGER log_participant_access_expiration
    AFTER UPDATE ON conversation_participants
    FOR EACH ROW
    WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION trigger_log_participant_access_expiration();

-- 8. Function to automatically deactivate expired participants
CREATE OR REPLACE FUNCTION deactivate_expired_participants()
RETURNS INTEGER AS $$
DECLARE
    deactivated_count INTEGER;
BEGIN
    WITH deactivated AS (
        UPDATE conversation_participants
        SET is_active = FALSE
        WHERE is_active = TRUE
        AND access_expires_at IS NOT NULL
        AND access_expires_at < NOW()
        RETURNING *
    )
    SELECT COUNT(*) INTO deactivated_count FROM deactivated;

    RETURN deactivated_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Add RLS policy updates for expired access
-- Update existing message insert policy to check expiration
DROP POLICY IF EXISTS "Users can insert messages in accessible conversations" ON messages;
CREATE POLICY "Users can insert messages in accessible conversations" ON messages
    FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
        OR (
            conversation_id IN (
                SELECT conversation_id
                FROM conversation_participants
                WHERE user_id = auth.uid()
                AND permission = 'chat'
                AND is_active = TRUE
                AND (access_expires_at IS NULL OR access_expires_at > NOW())
            )
        )
    );

-- 10. View to show participant access status
CREATE OR REPLACE VIEW participant_access_status AS
SELECT
    cp.id,
    cp.conversation_id,
    cp.user_id,
    cp.permission,
    cp.joined_at,
    cp.access_expires_at,
    cp.is_active,
    CASE
        WHEN cp.access_expires_at IS NULL THEN 'never_expires'
        WHEN cp.access_expires_at > NOW() THEN 'active'
        ELSE 'expired'
    END as access_status,
    CASE
        WHEN cp.access_expires_at IS NULL THEN NULL
        WHEN cp.access_expires_at > NOW() THEN cp.access_expires_at - NOW()
        ELSE INTERVAL '0'
    END as time_remaining
FROM conversation_participants cp;

-- Grant access to the view
GRANT SELECT ON participant_access_status TO authenticated;

-- Migration complete
