# Wallet System & Rate Limiting Implementation

## ✅ Completed Features

### 1. Database Schema
Created 2 new migration files:

**`backend_code/API/migration_004_wallet_system.sql`**
- `user_wallets` table - stores user balance
- `api_usage` table - logs all API requests with costs
- Automatic wallet creation on user signup
- RLS policies for security

**`backend_code/API/migration_005_profile_rate_limits.sql`**
- Added rate limiting columns to `routing_profiles` table
- `profile_rate_limits` table - tracks usage per profile
- Supports per-minute, per-hour, and per-day limits

### 2. Backend API

**`backend_code/API/wallet.py`**
- `DEVELOPMENT_MODE = True` - bypasses wallet checks during development
- Cost calculation for all providers (OpenAI, Anthropic, Google)
- Wallet balance checking
- Cost deduction after each request
- Usage logging
- Add funds endpoint (for testing)

**`backend_code/API/rate_limiter.py`**
- Per-profile rate limiting
- Automatic time window management
- Counter reset logic

**`backend_code/API/router.py` (Updated)**
- Integrated wallet balance checking before inference
- Deducts actual cost after inference (both streaming & non-streaming)
- Logs all API usage to database
- Checks profile rate limits if profile is used
- Returns HTTP 402 if insufficient balance
- Returns HTTP 429 if rate limit exceeded

**`backend_code/app.py` (Updated)**
- `/chat` endpoint now checks wallet balance before inference
- `/chat/batch` endpoint checks balance for each model in the batch
- Both endpoints deduct actual costs and log usage
- Returns HTTP 402 if insufficient balance
- Works with `DEVELOPMENT_MODE = True` for testing without funds

**New API Endpoints:**
- `GET /v1/wallet` - Get wallet balance
- `POST /v1/wallet/add-funds?amount=10` - Add funds (test only)
- `GET /v1/usage?limit=100` - Get usage history

### 3. Frontend UI

**`frontend/index.html` (Updated)**
- Added wallet balance display in sidebar
- Shows balance prominently in gold
- "Add Funds" button
- Hidden when not logged in

**`frontend/wallet.js` (New)**
- Loads wallet balance on page load
- Auto-refreshes every 30 seconds
- "Add Funds" modal (test mode)
- Updates balance after requests

---

## 📋 Setup Instructions

### Step 1: Run Database Migrations

Run these SQL files in your Supabase SQL editor:

```sql
-- 1. Run migration_004_wallet_system.sql
-- Creates wallets and usage tracking

-- 2. Run migration_005_profile_rate_limits.sql
-- Adds rate limiting to profiles
```

### Step 2: Restart Backend Server

```bash
# Stop the current server (Ctrl+C)
# Start it again
uvicorn backend_code.app:app --reload
```

### Step 3: Test the Wallet System

**Using the test file:**
```bash
python test_streaming.py
```

With `DEVELOPMENT_MODE = True`, this will work even with $0 balance.

**To test actual wallet deduction:**
1. Set `DEVELOPMENT_MODE = False` in `backend_code/API/wallet.py`
2. Add funds via API:
   ```bash
   curl -X POST "http://localhost:8000/v1/wallet/add-funds?amount=5" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```
3. Check balance:
   ```bash
   curl "http://localhost:8000/v1/wallet" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```
4. Make requests - balance will decrease

---

## 🔧 Configuration

### Development Mode

**CURRENT STATUS: `DEVELOPMENT_MODE = True`** ✅

This means you can use the web app and API **without any money in your wallet** during development.

In `backend_code/API/wallet.py`:
```python
# Set to True for development (bypasses wallet checks)
DEVELOPMENT_MODE = True

# Set to False for production (enforces wallet balance)
DEVELOPMENT_MODE = False
```

**What DEVELOPMENT_MODE does:**
- ✅ Allows all requests even with $0.00 balance
- ✅ Still logs usage to `api_usage` table
- ✅ Still shows wallet balance in UI
- ❌ Does NOT deduct from wallet
- ❌ Does NOT block requests with insufficient funds

**When to disable:**
- Before launching MVP to real users
- When you want to test actual wallet deductions
- For production deployment

### Pricing Configuration

Update pricing in `backend_code/API/wallet.py`:
```python
PRICING = {
    "openai": {
        "gpt-5": {"input": 5.00, "output": 15.00},  # per 1M tokens
        # Add more models...
    },
    # Add more providers...
}
```

---

## 🎯 How It Works

### Request Flow

The wallet system is integrated into **ALL** endpoints:
- `/v1/chat/completions` (OpenAI-compatible API)
- `/chat` (Web app chat endpoint)
- `/chat/batch` (Web app batch endpoint)

**Flow:**
1. **User makes request** → Web app or API
2. **Authentication** → Validates JWT/API key
3. **Rate Limiting** → Checks profile rate limits (if using profile)
4. **Balance Check** → Estimates cost, checks if balance ≥ cost
   - If insufficient: Returns HTTP 402 (unless DEVELOPMENT_MODE = True)
5. **Inference** → Calls LLM provider
6. **Cost Deduction** → Calculates actual cost, deducts from wallet (unless DEVELOPMENT_MODE = True)
7. **Usage Logging** → Saves to `api_usage` table (always, even in dev mode)
8. **Response** → Returns completion to user

### Cost Calculation

```
Cost = (Input Tokens × Input Price / 1M) + (Output Tokens × Output Price / 1M)
```

Example:
- Model: GPT-5
- Input: 1,000 tokens × $5/1M = $0.005
- Output: 500 tokens × $15/1M = $0.0075
- **Total: $0.0125**

---

## 🚧 Still TODO

### 1. Rate Limit UI in Routing Lab
**Status:** Backend ready, UI pending

**What's needed:**
- Add rate limit input fields to profile builder
- Fields: `rate_limit_rpm`, `rate_limit_rph`, `rate_limit_rpd`
- Save to database when profile is created/updated

**Location:** `frontend/routingLabProfileBuilder.js`

### 2. Real Statistics Data
**Status:** Mock data showing, need to connect to `api_usage` table

**What's needed:**
- Replace mock data with queries to `api_usage` table
- Show real token usage, costs, model distribution
- Profile stats button should show actual profile usage

**Tables to query:**
- `api_usage` - all request data
- `user_wallets` - spending over time

### 3. Payment Integration
**Status:** Test endpoint only, no real payments

**What's needed (later):**
- Integrate Stripe/PayPal
- Replace `/wallet/add-funds` with real payment processing
- Add webhook handlers for payment confirmation

---

## 📊 Database Tables

### `user_wallets`
```sql
id          UUID
user_id     UUID (references auth.users)
balance     DECIMAL(10, 4)  -- Current balance in USD
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### `api_usage`
```sql
id                  UUID
user_id             UUID
api_key_id          UUID (nullable)
endpoint            TEXT
method              TEXT
provider            TEXT  -- openai, anthropic, google
model               TEXT
profile_name        TEXT (nullable)
input_tokens        INTEGER
output_tokens       INTEGER
total_tokens        INTEGER
estimated_cost      DECIMAL(10, 6)
status_code         INTEGER
error_message       TEXT (nullable)
request_duration_ms INTEGER (nullable)
created_at          TIMESTAMPTZ
```

### `routing_profiles` (Updated)
```sql
-- Existing columns...
rate_limit_rpm      INTEGER (nullable)  -- Requests per minute
rate_limit_rph      INTEGER (nullable)  -- Requests per hour
rate_limit_rpd      INTEGER (nullable)  -- Requests per day
```

### `profile_rate_limits`
```sql
id                    UUID
profile_slug          TEXT
user_id               UUID
minute_window         TIMESTAMPTZ
hour_window           TIMESTAMPTZ
day_window            TIMESTAMPTZ
requests_this_minute  INTEGER
requests_this_hour    INTEGER
requests_this_day     INTEGER
updated_at            TIMESTAMPTZ
```

---

## 🐛 Testing Checklist

- [ ] Run both SQL migrations
- [ ] Restart backend server
- [ ] Verify wallet displays in frontend sidebar
- [ ] Test "Add Funds" button
- [ ] Make API request, verify balance decreases
- [ ] Check `api_usage` table has new rows
- [ ] Test with $0 balance (should get HTTP 402)
- [ ] Test streaming vs non-streaming (both should log costs)
- [ ] Verify rate limiting (create profile with limits)

---

## 💡 Next Steps

1. **Run migrations** (most important!)
2. **Test with development mode** enabled
3. **Add rate limit UI** to profile builder
4. **Connect real statistics** to dashboard
5. **Disable development mode** for production
6. **Add payment gateway** when ready to launch

---

## 🎨 Frontend Screenshots

### Wallet Balance Display
Located in left sidebar, below navigation:
- Shows current balance in gold
- "Add Funds" button
- Auto-updates every 30 seconds

### Expected Behavior
- Hidden when logged out
- Shows $0.00 for new users
- Updates after each API request
- Clickable "Add Funds" for testing

---

## Questions?

- Wallet not showing? Check browser console for errors
- Balance not decreasing? Check `DEVELOPMENT_MODE` setting
- Database errors? Ensure migrations ran successfully
- Rate limiting not working? Check profile has rate_limit fields set
