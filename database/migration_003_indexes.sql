-- Migration 003: Indexes for Performance
-- Creates indexes on frequently queried columns

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email
    ON profiles(email);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
    ON conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at
    ON conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_created
    ON conversations(user_id, created_at DESC);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
    ON messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_messages_role
    ON messages(role);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_role_created
    ON messages(conversation_id, role, created_at ASC);

-- Comments
COMMENT ON INDEX idx_conversations_user_created IS 'Optimize fetching user conversations sorted by date';
COMMENT ON INDEX idx_messages_conversation_created IS 'Optimize fetching conversation messages in chronological order';
COMMENT ON INDEX idx_messages_conversation_role_created IS 'Optimize filtering messages by role within a conversation';
