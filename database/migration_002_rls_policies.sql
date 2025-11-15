-- Migration 002: Row Level Security Policies
-- Enables RLS and creates policies to ensure users can only access their own data

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Conversations policies
-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
    ON conversations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own conversations
CREATE POLICY "Users can insert own conversations"
    ON conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON conversations
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
    ON conversations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Messages policies
-- Users can view messages from their own conversations
CREATE POLICY "Users can view own messages"
    ON messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Users can insert messages into their own conversations
CREATE POLICY "Users can insert own messages"
    ON messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Users can update messages in their own conversations
CREATE POLICY "Users can update own messages"
    ON messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Users can delete messages in their own conversations
CREATE POLICY "Users can delete own messages"
    ON messages
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND conversations.user_id = auth.uid()
        )
    );

-- Comments
COMMENT ON POLICY "Users can view own profile" ON profiles IS 'Allow users to view their own profile';
COMMENT ON POLICY "Users can view own conversations" ON conversations IS 'Allow users to view only their conversations';
COMMENT ON POLICY "Users can view own messages" ON messages IS 'Allow users to view messages from their conversations only';
