# Participant Time Limits Feature

## Overview

Conversation owners can now set time limits for how long participants can send messages in shared conversations. This provides additional control over access and helps prevent unexpected long-term costs.

---

## Time Limit Options

### Preset Durations
- **1 Hour** - Participants can chat for 1 hour after joining
- **24 Hours (1 Day)** - Participants can chat for 24 hours after joining
- **7 Days (1 Week)** - Participants can chat for 7 days after joining (default)
- **Forever** ⚠️ - Participants can chat indefinitely (warning shown)
- **Custom** ⚠️ - Owner sets custom hours (1-8760) (warning shown)

### Warnings
- **Forever**: Shows warning about potential unexpected costs if shared publicly
- **Custom**: Shows warning to use carefully and consider preset options for safety

---

## How It Works

### 1. Creating Share Link with Time Limit

**Frontend:**
```javascript
// User selects "7 Days" from dropdown
const shareData = await shareConversation(
    conversationId,
    'chat',        // permission
    'owner',       // billing
    '7d',          // participant_access_duration
    null           // custom_hours (not needed for preset)
);

// User selects "Custom" and enters 48 hours
const shareData = await shareConversation(
    conversationId,
    'chat',
    'owner',
    'custom',      // participant_access_duration
    48             // custom_hours
);
```

**Backend:**
```bash
POST /v1/conversations/{id}/share
{
    "permission": "chat",
    "billing": "owner",
    "participant_access_duration": "7d",  // or "1h", "24h", "forever", "custom"
    "participant_access_custom_hours": null  // only if "custom"
}
```

### 2. Participant Joins

When a participant joins via share link:

1. Database trigger calculates expiration timestamp based on duration setting
2. Sets `access_expires_at` on participant record
3. Logs join event with expiration details in audit log

**Example:**
```sql
-- Participant joins at 2025-12-31 10:00:00
-- Duration is "7d"
-- access_expires_at set to 2026-01-07 10:00:00
```

### 3. Access Expiration Check

Before each message, the system checks:

1. Participant exists and is active
2. `access_expires_at` is NULL (never expires) OR current time < `access_expires_at`
3. If expired: HTTP 403 error with expiration timestamp

**Example Error:**
```json
{
    "detail": "Your chat access to this conversation has expired. Access ended at: 2026-01-07T10:00:00Z"
}
```

### 4. Automatic Deactivation

Background function can be run periodically to deactivate expired participants:

```sql
SELECT deactivate_expired_participants();
-- Returns: Number of participants deactivated
```

This can be scheduled as a cron job or Supabase Edge Function.

---

## Database Schema

### New Columns in `conversations`

```sql
-- Duration setting (what owner selected)
participant_access_duration TEXT DEFAULT 'forever'
    CHECK (participant_access_duration IN ('1h', '24h', '7d', 'forever', 'custom'))

-- For custom duration, number of hours
participant_access_hours INTEGER
```

### New Column in `conversation_participants`

```sql
-- When participant's chat access expires
access_expires_at TIMESTAMPTZ
```

### View: `participant_access_status`

```sql
SELECT * FROM participant_access_status
WHERE conversation_id = 'abc-123';
```

Returns:
- `access_status`: 'never_expires', 'active', or 'expired'
- `time_remaining`: Interval until expiration (or NULL)

---

## Frontend UI

### Share Modal - New Section

```html
<div>
    <label>Participant Chat Duration</label>
    <select id="share-access-duration">
        <option value="1h">1 Hour</option>
        <option value="24h">24 Hours (1 Day)</option>
        <option value="7d" selected>7 Days (1 Week)</option>
        <option value="forever">Forever ⚠️</option>
        <option value="custom">Custom ⚠️</option>
    </select>
    <p id="access-duration-help">
        How long participants can send messages after joining
    </p>

    <!-- Shown when "Custom" selected -->
    <div id="custom-hours-input" style="display: none;">
        <input type="number" id="custom-hours"
               placeholder="Hours (1-8760)" min="1" max="8760">
    </div>
</div>
```

### Dynamic Help Text & Warnings

**Default (1h, 24h, 7d):**
> How long participants can send messages after joining

**Forever selected:**
> ⚠️ Warning: Participants will be able to send messages indefinitely. This may lead to unexpected costs if the conversation is shared publicly.

**Custom selected:**
> ⚠️ Warning: Custom durations should be used carefully. Consider using preset options for safety.

---

## API Changes

### Share Endpoint - NEW Parameters

```bash
POST /v1/conversations/{id}/share

{
    "permission": "chat",
    "billing": "owner",
    "expires_in": "7d",                          # Link expiration
    "max_participants": 10,
    "participant_access_duration": "7d",         # NEW: Participant chat duration
    "participant_access_custom_hours": null      # NEW: For custom duration
}
```

**Validation:**
- `participant_access_duration` must be one of: 1h, 24h, 7d, forever, custom
- If `custom`, `participant_access_custom_hours` required (1-8760)

**Response:**
```json
{
    "object": "conversation_share",
    "data": {
        "conversation_id": "abc-123",
        "share_token": "xyz...",
        "permission": "chat",
        "billing": "owner",
        "shared_at": "2025-12-31T10:00:00Z",
        "expires_at": "2026-01-07T10:00:00Z",
        "max_participants": 10,
        "participant_access_duration": "7d",     # NEW
        "participant_access_hours": null         # NEW
    }
}
```

---

## Use Cases

### 1. Temporary Collaboration (24 Hours)

```javascript
// Share for one-time collaboration
await shareConversation(convId, 'chat', 'owner', '24h');
```

**Scenario:** Team working on urgent project for one day
- Participants join and collaborate
- After 24 hours, they can still view but not send messages
- Prevents accidental long-term access

### 2. Short-term Testing (1 Hour)

```javascript
// Share for quick testing
await shareConversation(convId, 'chat', 'individual', '1h');
```

**Scenario:** Testing integration with external developer
- Each person pays for their own messages
- Access automatically expires after 1 hour
- No manual cleanup needed

### 3. Week-Long Project (7 Days - Default)

```javascript
// Share for week-long project
await shareConversation(convId, 'chat', 'owner', '7d');
```

**Scenario:** Multi-day hackathon or sprint
- Participants have access for full week
- Automatically expires at end of sprint
- Owner can extend by resharing

### 4. Permanent Shared Space (Forever - With Warning)

```javascript
// Share permanently (user sees warning)
await shareConversation(convId, 'chat', 'individual', 'forever');
```

**Scenario:** Long-term community or support chat
- Individual billing to prevent owner cost exposure
- Warning shown to owner about permanent access
- Should be used with participant limits

### 5. Custom Duration (48 Hours)

```javascript
// Share for custom 48-hour period
await shareConversation(convId, 'chat', 'owner', 'custom', 48);
```

**Scenario:** Event running over weekend
- Precisely match event duration
- Warning shown to consider preset options
- Valid from 1 hour to 1 year (8760 hours)

---

## Security Benefits

### Before Time Limits:
- ❌ Participants could chat forever
- ❌ No automatic access expiration
- ❌ Manual tracking required
- ❌ Forgotten shared links = long-term costs

### After Time Limits:
- ✅ Automatic access expiration
- ✅ Reduced risk of forgotten participants
- ✅ Granular control (1h to 1 year)
- ✅ Warnings for risky options (forever, custom)
- ✅ Audit logging of expirations

---

## Implementation Files

### New Files
1. `migration_010_participant_time_limits.sql` - Database schema
2. `PARTICIPANT_TIME_LIMITS.md` - This documentation

### Modified Files
1. `shared_conversation_rate_limiter.py` - Added `access_expired` check to `get_participant_info()`
2. `conversation_sharing.py` - Added time limit parameters to `share_conversation()`
3. `router.py` - Added time limit validation and expiration check
4. `frontend/collaboration.js` - Added time limit UI with warnings

---

## Monitoring & Maintenance

### Check Participants Nearing Expiration

```sql
SELECT
    cp.user_id,
    cp.conversation_id,
    cp.access_expires_at,
    cp.access_expires_at - NOW() as time_remaining
FROM conversation_participants cp
WHERE cp.access_expires_at IS NOT NULL
AND cp.access_expires_at > NOW()
AND cp.access_expires_at < NOW() + INTERVAL '1 day'
ORDER BY cp.access_expires_at;
```

### View Expired Participants

```sql
SELECT * FROM participant_access_status
WHERE access_status = 'expired'
AND is_active = TRUE;  -- Still marked active (not yet deactivated)
```

### Deactivate Expired Participants

```sql
-- Run periodically (e.g., hourly cron job)
SELECT deactivate_expired_participants();
-- Returns: 5 (5 participants deactivated)
```

### Audit Log of Expirations

```sql
SELECT
    to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as time,
    user_id,
    action,
    metadata->>'expired_at' as expired_at
FROM conversation_audit_log
WHERE action = 'access_expired'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Testing

### Test 1: Participant Access Expires After Duration

```bash
# 1. Create conversation with 1-hour access
POST /v1/conversations/{id}/share
{"participant_access_duration": "1h"}

# 2. Join as participant
POST /v1/conversations/join/{token}

# 3. Send message (should work)
POST /v1/chat/completions
{"restruct": {"conversation_id": "..."}}

# 4. Wait 61 minutes (or manually update access_expires_at to past)
UPDATE conversation_participants
SET access_expires_at = NOW() - INTERVAL '1 minute'
WHERE user_id = '...';

# 5. Try to send message (should get 403)
POST /v1/chat/completions
{"restruct": {"conversation_id": "..."}}
# Expected: HTTP 403 "Your chat access to this conversation has expired"
```

### Test 2: Custom Duration Validation

```javascript
// Try invalid custom hours
await shareConversation(convId, 'chat', 'owner', 'custom', 0);
// Expected: Error "participant_access_custom_hours must be between 1 and 8760"

// Try custom without hours
await shareConversation(convId, 'chat', 'owner', 'custom', null);
// Expected: Error "participant_access_custom_hours required for custom duration"
```

### Test 3: Forever Duration Warning

```javascript
// Select "Forever" in dropdown
// Expected: Warning message appears:
// "⚠️ Warning: Participants will be able to send messages indefinitely..."
```

---

## Migration Steps

1. **Run Migration:**
   ```sql
   -- In Supabase SQL Editor
   -- Execute migration_010_participant_time_limits.sql
   ```

2. **Verify Tables Updated:**
   ```sql
   -- Check new columns exist
   SELECT participant_access_duration, participant_access_hours
   FROM conversations LIMIT 1;

   SELECT access_expires_at
   FROM conversation_participants LIMIT 1;
   ```

3. **Test View:**
   ```sql
   SELECT * FROM participant_access_status LIMIT 5;
   ```

4. **Restart Backend:**
   ```bash
   uvicorn backend_code.app:app --reload
   ```

5. **Test Frontend:**
   - Open share modal
   - Verify new "Participant Chat Duration" dropdown
   - Select "Forever" - verify warning appears
   - Select "Custom" - verify custom hours input appears

---

## Best Practices

### ✅ Recommended

1. **Use preset durations** (1h, 24h, 7d) whenever possible
2. **Set 7d as default** for most collaborative scenarios
3. **Use individual billing** with "forever" duration to limit owner exposure
4. **Monitor audit logs** for unexpected expirations
5. **Set up automatic deactivation** cron job (hourly)

### ⚠️ Use Caution

6. **Forever duration** - Only for trusted, limited participants
7. **Custom durations** - Validate business need first
8. **Owner pays + forever** - High cost risk if shared publicly

### ❌ Avoid

9. **Forever + public sharing** - Extremely risky
10. **Custom > 1 year** - Use forever instead (no functional difference)

---

## FAQ

**Q: What happens to participants after access expires?**
A: They can still view messages but cannot send new messages. They get HTTP 403 error with expiration timestamp.

**Q: Can owner extend participant access?**
A: Not directly. Owner can unshare and reshare with new settings, or manually update `access_expires_at` in database.

**Q: Does expiration apply to conversation owner?**
A: No, conversation owners always have unlimited access.

**Q: What's the maximum custom duration?**
A: 8760 hours (1 year). Longer than that should use "forever".

**Q: How often should deactivate_expired_participants() run?**
A: Hourly is recommended. The expiration check happens in real-time anyway, so this is mainly for cleanup and audit logging.

**Q: Can view-only participants have time limits?**
A: Yes, but they already can't send messages, so the limit only affects if owner later changes their permission to "chat".

---

**Implementation Date:** 2025-12-31
**Status:** COMPLETE
**Migration:** `migration_010_participant_time_limits.sql`
