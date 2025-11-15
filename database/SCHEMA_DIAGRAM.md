# Database Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────┐
│     auth.users          │  (Supabase built-in)
│                         │
│  - id (UUID, PK)        │
│  - email                │
│  - encrypted_password   │
│  - created_at           │
└───────────┬─────────────┘
            │
            │ 1:1
            │
┌───────────▼─────────────┐
│      profiles           │
│                         │
│  - id (UUID, PK, FK)    │───┐
│  - email                │   │
│  - created_at           │   │
│  - updated_at           │   │
└─────────────────────────┘   │
                              │
                              │ 1:N (one user has many conversations)
                              │
                    ┌─────────▼─────────────┐
                    │    conversations      │
                    │                       │
                    │  - id (UUID, PK)      │───┐
                    │  - user_id (UUID, FK) │   │
                    │  - title              │   │
                    │  - created_at         │   │
                    │  - updated_at         │   │
                    └───────────────────────┘   │
                                                │
                                                │ 1:N (one conversation has many messages)
                                                │
                                      ┌─────────▼─────────────┐
                                      │      messages         │
                                      │                       │
                                      │  - id (UUID, PK)      │
                                      │  - conversation_id    │
                                      │    (UUID, FK)         │
                                      │  - role               │
                                      │    ('user'|'assistant')│
                                      │  - content            │
                                      │  - model              │
                                      │  - provider           │
                                      │  - profile_name       │
                                      │  - metadata (JSONB)   │
                                      │  - created_at         │
                                      └───────────────────────┘
```

## Table Details

### profiles
- **Primary Key**: `id` (references `auth.users.id`)
- **Purpose**: Extends Supabase's built-in auth with custom user data
- **Relationship**: One profile per authenticated user
- **Auto-created**: When user signs up via trigger

### conversations
- **Primary Key**: `id` (auto-generated UUID)
- **Foreign Key**: `user_id` → `profiles.id` (CASCADE delete)
- **Purpose**: Stores chat sessions for each user
- **Fields**:
  - `title`: Conversation name (default: "New Conversation")
  - `created_at`, `updated_at`: Timestamps
- **Relationship**: One user can have many conversations

### messages
- **Primary Key**: `id` (auto-generated UUID)
- **Foreign Key**: `conversation_id` → `conversations.id` (CASCADE delete)
- **Purpose**: Stores individual chat messages
- **Fields**:
  - `role`: Either 'user' or 'assistant'
  - `content`: The message text
  - `model`: LLM model name (e.g., "gpt-4", "claude-sonnet-4.5")
  - `provider`: Provider name ("openai", "anthropic", "google")
  - `profile_name`: Routing profile used
  - `metadata`: JSON object for additional data (latency, cost, tokens, etc.)
  - `created_at`: Message timestamp
- **Relationship**: One conversation can have many messages

## Example Data Flow

```
1. User signs up
   └─> Trigger creates profile in `profiles` table

2. User starts new chat
   └─> Creates row in `conversations` table
       - user_id: linked to profile
       - title: "New Conversation"

3. User sends message "Hello!"
   └─> Creates row in `messages` table
       - conversation_id: linked to conversation
       - role: "user"
       - content: "Hello!"

4. Assistant responds "Hi there!"
   └─> Creates row in `messages` table
       - conversation_id: same conversation
       - role: "assistant"
       - content: "Hi there!"
       - model: "gpt-4"
       - provider: "openai"
       - profile_name: "default"
       - metadata: {"latency": 250, "tokens": 5}

5. User starts second chat
   └─> Creates new row in `conversations` table
       - Same user_id, different conversation_id
       - New messages link to this conversation_id
```

## Cascade Deletion

When you delete:
- **User**: All their profiles, conversations, and messages are deleted
- **Conversation**: All messages in that conversation are deleted
- **Message**: Only that specific message is deleted

## Security (RLS Policies)

- Users can **only** see their own data
- Users **cannot** access other users' conversations or messages
- Enforced at database level by Row Level Security
- Even if frontend is compromised, users can't access others' data
