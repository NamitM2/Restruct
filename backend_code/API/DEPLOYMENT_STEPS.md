# Conversation Sharing Security - Deployment Steps

## Quick Start

### Step 1: Run Database Migration

1. Open Supabase SQL Editor
2. Copy contents of `migration_009_conversation_security.sql`
3. Paste and execute
4. Verify tables created:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN (
       'share_token_usage',
       'participant_rate_limits',
       'conversation_rate_limits',
       'conversation_audit_log',
       'participant_abuse_flags'
   );
   ```
   Should return 5 rows.

### Step 2: Restart Backend Server

```bash
# Stop existing server (Ctrl+C)

# Restart
uvicorn backend_code.app:app --reload
```

### Step 3: Verify Implementation

```bash
# Test that new endpoints accept new parameters
curl -X POST http://localhost:8000/v1/conversations/{conversation_id}/share \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "permission": "chat",
    "billing": "individual",
    "expires_in": "7d",
    "max_participants": 10
  }'
```

### Step 4: Update Frontend (Optional)

The frontend can now send conversation_id in requests:

```javascript
// In your chat/inference code
const response = await client.chat.completions.create({
    model: "auto",
    messages: messages,
    restruct: {
        conversation_id: currentConversation.id  // Add this
    }
});
```

This enables:
- Per-participant rate limiting
- Correct billing enforcement
- Conversation usage tracking

---

## Files Changed

### New Files
- `backend_code/API/migration_009_conversation_security.sql`
- `backend_code/API/shared_conversation_rate_limiter.py`
- `backend_code/API/shared_conversation_billing.py`
- `backend_code/API/CONVERSATION_SHARING_SECURITY.md`
- `backend_code/API/IMPLEMENTATION_SUMMARY.md`
- `backend_code/API/DEPLOYMENT_STEPS.md` (this file)

### Modified Files
- `backend_code/API/schemas.py` - Added conversation_id to RestructParams
- `backend_code/API/router.py` - Security checks, billing enforcement
- `backend_code/API/conversation_sharing.py` - Token expiration, limits

---

## Verification Tests

### Test 1: Rate Limiting Works

```python
# Create shared conversation
# Have participant send 15 messages rapidly
# Expected: First 10 succeed, next 5 get HTTP 429
```

### Test 2: Billing Enforcement Works

```python
# Create conversation with billing="individual"
# Participant sends message
# Check database: cost deducted from participant, not owner
```

### Test 3: Token Expiration Works

```python
# Create share link with expires_in="1h"
# Update share_expires_at to past time
# Try to join
# Expected: HTTP 400 "Share link has expired"
```

### Test 4: Participant Limits Work

```python
# Create share link with max_participants=2
# Have 3 different users try to join
# Expected: First 2 succeed, 3rd gets "Maximum participants reached"
```

---

## Monitoring

### Check Audit Logs

```sql
SELECT
    to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as time,
    action,
    metadata
FROM conversation_audit_log
WHERE conversation_id = 'your-conversation-id'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Join Events

```sql
SELECT
    to_char(joined_at, 'YYYY-MM-DD HH24:MI:SS') as time,
    joined_user_id,
    join_ip
FROM share_token_usage
WHERE conversation_id = 'your-conversation-id'
ORDER BY joined_at DESC;
```

### Check Rate Limit Status

```sql
SELECT
    user_id,
    requests_this_minute,
    requests_this_hour,
    requests_this_day,
    to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_request
FROM participant_rate_limits
WHERE conversation_id = 'your-conversation-id';
```

### Check Billing Distribution

```sql
SELECT
    user_id,
    COUNT(*) as requests,
    SUM(cost) as total_cost
FROM api_usage
WHERE conversation_id = 'your-conversation-id'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY total_cost DESC;
```

---

## Rollback Plan

If something goes wrong:

### Option 1: Disable Security Checks

In `router.py`, comment out lines 105-184 (shared conversation security checks).

### Option 2: Rollback Migration

```sql
-- Drop new tables
DROP TABLE IF EXISTS participant_abuse_flags CASCADE;
DROP TABLE IF EXISTS conversation_audit_log CASCADE;
DROP TABLE IF EXISTS conversation_rate_limits CASCADE;
DROP TABLE IF EXISTS participant_rate_limits CASCADE;
DROP TABLE IF EXISTS share_token_usage CASCADE;

-- Remove new columns
ALTER TABLE conversations
DROP COLUMN IF EXISTS share_expires_at,
DROP COLUMN IF EXISTS share_max_participants,
DROP COLUMN IF EXISTS share_join_count,
DROP COLUMN IF EXISTS share_require_approval;

ALTER TABLE conversation_participants
DROP COLUMN IF EXISTS paused_at,
DROP COLUMN IF EXISTS blocked_for_abuse;

-- Drop functions
DROP FUNCTION IF EXISTS is_share_token_valid(TEXT);
DROP FUNCTION IF EXISTS log_conversation_audit;
DROP FUNCTION IF EXISTS cleanup_old_rate_limit_windows();
```

---

## Troubleshooting

### Issue: "conversation_id not found" errors

**Cause:** Frontend not sending conversation_id in requests

**Fix:** Update frontend to include conversation_id in restruct params

### Issue: Rate limits too strict

**Cause:** Default limits may be too low for your use case

**Fix:** Adjust limits in `shared_conversation_rate_limiter.py`:
```python
# Change these values:
RATE_LIMIT_RPM = 10  # Increase to 20 or 50
RATE_LIMIT_RPH = 100  # Increase to 200 or 500
RATE_LIMIT_RPD = 500  # Increase to 1000 or 2000
```

### Issue: Billing deducted from wrong user

**Cause:** conversation_id not being passed or billing mode not set correctly

**Fix:**
1. Verify conversation has correct share_billing value
2. Ensure conversation_id passed in request
3. Check logs to see who's being billed

### Issue: Share links not expiring

**Cause:** expires_in not being set or null

**Fix:** Always set expires_in when creating share link (default is 7d)

---

## Performance Considerations

### Database Indexes

All necessary indexes are created by migration:
- `idx_participant_rate_limits_conversation`
- `idx_participant_rate_limits_user`
- `idx_conversation_rate_limits_conversation`
- `idx_conversation_audit_log_conversation`
- `idx_share_token_usage_conversation`

### Cleanup

Run periodically (cron job or Supabase function):
```sql
SELECT cleanup_old_rate_limit_windows();
```

This removes stale rate limit records.

### Expected Load

Per request overhead:
- 2-3 additional database queries (participant info, rate limits)
- ~5-10ms latency added
- Minimal impact on performance

---

## Security Best Practices

1. **Always set expiration** - Don't use permanent share links
2. **Limit participants** - Keep max_participants reasonable (10-20)
3. **Monitor audit logs** - Check for suspicious activity weekly
4. **Individual billing for public shares** - Don't pay for strangers
5. **Review share token usage** - Check who's joining your conversations

---

## Support

For issues:
1. Check `CONVERSATION_SHARING_SECURITY.md` for detailed analysis
2. Check `IMPLEMENTATION_SUMMARY.md` for implementation details
3. Check Supabase logs for database errors
4. Check FastAPI logs for application errors

---

**Deployment Date:** 2025-12-31
**Status:** READY FOR DEPLOYMENT
**Estimated Deployment Time:** 5-10 minutes
