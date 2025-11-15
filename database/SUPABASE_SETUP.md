# Supabase Setup Guide for Restruct

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" or "Sign In"
3. Sign up/Sign in with GitHub (recommended) or email
4. Click "New Project"
5. Fill in the details:
   - **Name**: `restruct` (or your preferred name)
   - **Database Password**: Generate a strong password and **SAVE IT** - you'll need this
   - **Region**: Choose closest to your users (e.g., `us-east-1` for East US)
   - **Pricing Plan**: Free tier is fine to start
6. Click "Create new project"
7. Wait 2-3 minutes for project provisioning

## Step 2: Get Your API Keys

1. Once the project is created, go to **Project Settings** (gear icon in sidebar)
2. Click **API** in the left menu
3. You'll see two important values:

   **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (very long string)

4. **SAVE THESE VALUES** - you'll add them to your `.env` file

## Step 3: Create Environment Variables File

Create a `.env` file in your project root (`c:\Users\namit\Documents\Restruct\.env`):

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_KEY=your_anon_key_here

# Keep your existing API keys
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
ANTHROPIC_API_KEY=your_anthropic_key
```

## Step 4: Run Database Migrations

1. In Supabase Dashboard, go to **SQL Editor** (in left sidebar)
2. Click **New Query**
3. Copy and paste the contents of `migration_001_initial_schema.sql`
4. Click **Run** (or press Ctrl+Enter)
5. Repeat for `migration_002_rls_policies.sql`
6. Repeat for `migration_003_indexes.sql`

You should see "Success. No rows returned" for each migration.

## Step 5: Verify Setup

1. Go to **Table Editor** in Supabase Dashboard
2. You should see these tables:
   - `profiles`
   - `conversations`
   - `messages`

## Step 6: Install Supabase Client

In your terminal, install the Supabase Python client:

```bash
pip install supabase
```

Update your `requirements.txt` to include:
```
supabase>=2.0.0
```

## Database Schema Overview

### Tables

1. **profiles** - User profile information
   - `id` (UUID, primary key, references auth.users)
   - `email` (text)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

2. **conversations** - Chat conversations
   - `id` (UUID, primary key)
   - `user_id` (UUID, references profiles)
   - `title` (text) - e.g., "Chat about Python"
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

3. **messages** - Individual messages in conversations
   - `id` (UUID, primary key)
   - `conversation_id` (UUID, references conversations)
   - `role` (text) - 'user' or 'assistant'
   - `content` (text) - the message content
   - `model` (text, nullable) - which model was used (for assistant messages)
   - `provider` (text, nullable) - OpenAI, Google, Anthropic
   - `profile_name` (text, nullable) - which routing profile was used
   - `created_at` (timestamp)

## Security Features

- **Row Level Security (RLS)** enabled on all tables
- Users can only see their own data
- Policies enforce user isolation
- Secure by default

## Next Steps

After setup, you'll need to:
1. Update backend code to use Supabase for auth
2. Store conversations and messages in database
3. Load conversation history from database
4. Implement conversation switching UI
