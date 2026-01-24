-- Migration 008: Shared Conversations & Real-time Collaboration
-- Allows users to share conversations and collaborate in real-time

-- 1. Add sharing metadata to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_permissions TEXT DEFAULT 'view' CHECK (share_permissions IN ('view', 'chat')),
ADD COLUMN IF NOT EXISTS share_billing TEXT DEFAULT 'owner' CHECK (share_billing IN ('owner', 'individual'));

-- Index for finding shared conversations
CREATE INDEX IF NOT EXISTS idx_conversations_share_token ON conversations(share_token) WHERE share_token IS NOT NULL;

-- 2. Conversation participants table
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'chat')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);

-- 3. Presence tracking for typing indicators
CREATE TABLE IF NOT EXISTS conversation_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT FALSE,
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_conversation ON conversation_presence(conversation_id);

-- Auto-cleanup old presence (older than 30 seconds considered disconnected)
CREATE INDEX IF NOT EXISTS idx_presence_heartbeat ON conversation_presence(last_heartbeat);

-- 4. Add message authorship tracking (if not already present)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update existing messages to have user_id from their conversation
UPDATE messages m
SET user_id = c.user_id
FROM conversations c
WHERE m.conversation_id = c.id AND m.user_id IS NULL;

-- 5. Row Level Security Policies

-- Conversations: Users can view conversations they own OR are participants in
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR id IN (
            SELECT conversation_id
            FROM conversation_participants
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    );

-- Conversations: Users can insert their own conversations
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
CREATE POLICY "Users can insert own conversations" ON conversations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Conversations: Users can update their own conversations OR shared conversations with chat permission
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations" ON conversations
    FOR UPDATE
    USING (
        user_id = auth.uid()
        OR id IN (
            SELECT conversation_id
            FROM conversation_participants
            WHERE user_id = auth.uid() AND permission = 'chat' AND is_active = TRUE
        )
    );

-- Conversations: Users can delete only their own conversations
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
CREATE POLICY "Users can delete own conversations" ON conversations
    FOR DELETE
    USING (user_id = auth.uid());

-- Messages: Users can view messages in conversations they have access to
DROP POLICY IF EXISTS "Users can view messages in accessible conversations" ON messages;
CREATE POLICY "Users can view messages in accessible conversations" ON messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
        OR conversation_id IN (
            SELECT conversation_id
            FROM conversation_participants
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    );

-- Messages: Users can insert messages in conversations with chat permission
DROP POLICY IF EXISTS "Users can insert messages in accessible conversations" ON messages;
CREATE POLICY "Users can insert messages in accessible conversations" ON messages
    FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
        OR conversation_id IN (
            SELECT conversation_id
            FROM conversation_participants
            WHERE user_id = auth.uid()
            AND permission = 'chat'
            AND is_active = TRUE
        )
    );

-- Participants: Users can view participants in conversations they have access to
DROP POLICY IF EXISTS "Users can view participants" ON conversation_participants;
CREATE POLICY "Users can view participants" ON conversation_participants
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Participants: Only conversation owners can manage participants
DROP POLICY IF EXISTS "Owners can manage participants" ON conversation_participants;
CREATE POLICY "Owners can manage participants" ON conversation_participants
    FOR ALL
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

-- Presence: Users can view presence in conversations they have access to
DROP POLICY IF EXISTS "Users can view presence" ON conversation_presence;
CREATE POLICY "Users can view presence" ON conversation_presence
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
        OR conversation_id IN (
            SELECT conversation_id
            FROM conversation_participants
            WHERE user_id = auth.uid() AND is_active = TRUE
        )
    );

-- Presence: Users can update their own presence
DROP POLICY IF EXISTS "Users can manage own presence" ON conversation_presence;
CREATE POLICY "Users can manage own presence" ON conversation_presence
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 6. Enable Realtime (only add if not already present)
DO $$
BEGIN
    -- Add conversation_participants to realtime if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'conversation_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
    END IF;

    -- Add conversation_presence to realtime if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'conversation_presence'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversation_presence;
    END IF;

    -- Add messages to realtime if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;

-- 7. Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
    token_exists BOOLEAN;
BEGIN
    LOOP
        token := encode(gen_random_bytes(16), 'base64');
        token := replace(replace(replace(token, '/', '_'), '+', '-'), '=', '');

        SELECT EXISTS(SELECT 1 FROM conversations WHERE share_token = token) INTO token_exists;

        IF NOT token_exists THEN
            RETURN token;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. Function to update presence heartbeat
CREATE OR REPLACE FUNCTION update_presence_heartbeat(
    p_conversation_id UUID,
    p_user_id UUID,
    p_is_typing BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
BEGIN
    INSERT INTO conversation_presence (conversation_id, user_id, is_typing, last_heartbeat)
    VALUES (p_conversation_id, p_user_id, p_is_typing, NOW())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET
        is_typing = p_is_typing,
        last_heartbeat = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_presence_heartbeat TO authenticated;
