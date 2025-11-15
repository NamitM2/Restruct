# Supabase Setup Quickstart Checklist

Follow these steps in order:

## ☐ 1. Create Supabase Project (5 minutes)

- [ ] Go to https://supabase.com and sign up/sign in
- [ ] Click "New Project"
- [ ] Name: `restruct`
- [ ] Generate and save database password
- [ ] Select region (e.g., `us-east-1`)
- [ ] Click "Create new project"
- [ ] Wait for provisioning (2-3 minutes)

## ☐ 2. Get API Credentials (1 minute)

- [ ] Go to Project Settings → API
- [ ] Copy **Project URL**
- [ ] Copy **anon public** key (the long JWT token)
- [ ] Keep this tab open

## ☐ 3. Configure Environment Variables (2 minutes)

- [ ] Open `c:\Users\namit\Documents\Restruct\.env` (create if doesn't exist)
- [ ] Add these lines:
  ```env
  SUPABASE_URL=<paste your project URL>
  SUPABASE_KEY=<paste your anon key>
  ```
- [ ] Save the file

## ☐ 4. Run Database Migrations (5 minutes)

- [ ] In Supabase Dashboard, go to **SQL Editor** (left sidebar)
- [ ] Click **New Query**
- [ ] Open `database/migration_001_initial_schema.sql`
- [ ] Copy all contents and paste into SQL Editor
- [ ] Click **Run** (should see "Success")
- [ ] Click **New Query** again
- [ ] Open `database/migration_002_rls_policies.sql`
- [ ] Copy, paste, and **Run**
- [ ] Click **New Query** again
- [ ] Open `database/migration_003_indexes.sql`
- [ ] Copy, paste, and **Run**

## ☐ 5. Verify Database Setup (2 minutes)

- [ ] Go to **Table Editor** in Supabase
- [ ] Confirm you see these tables:
  - `profiles`
  - `conversations`
  - `messages`
- [ ] Click on each table to verify columns exist

## ☐ 6. Install Python Dependencies (1 minute)

```bash
cd c:\Users\namit\Documents\Restruct
pip install supabase
```

Or update all dependencies:
```bash
pip install -r requirements.txt
```

## ☐ 7. Test Database Connection (2 minutes)

Create a test file `test_db.py`:

```python
from backend_code.database import supabase

# Test connection
try:
    # Try to query conversations table
    result = supabase.table("conversations").select("*").limit(1).execute()
    print("✓ Database connection successful!")
    print(f"Tables accessible: {result}")
except Exception as e:
    print(f"✗ Connection failed: {e}")
```

Run it:
```bash
python test_db.py
```

## ☐ 8. Next Steps

You're now ready to:
- [ ] Review `database/USAGE_EXAMPLES.md` for code examples
- [ ] Update your backend to save conversations
- [ ] Implement authentication (optional, can do later)
- [ ] Build conversation history UI

## Common Issues

**"Missing SUPABASE_URL"**
- Make sure `.env` file is in project root
- Check that variables are spelled correctly
- Restart your Python process after adding .env

**"Error: relation 'conversations' does not exist"**
- Migrations didn't run successfully
- Go back to Step 4 and run migrations again
- Check SQL Editor for error messages

**"Row Level Security policy violation"**
- RLS is enabled but you're not authenticated
- For testing, you can temporarily disable RLS on tables
- Or implement authentication first

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Python Client: https://github.com/supabase/supabase-py

---

**Total estimated time: 15-20 minutes** ⏱️
