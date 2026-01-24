# Conversation Sharing Security Analysis

## Current Vulnerabilities

### 1. **NO RATE LIMITING ON SHARED CONVERSATIONS**
**Severity: CRITICAL**

**Problem:**
- Participants can send unlimited messages in shared conversations
- No per-participant rate limits exist
- Only the conversation owner's API key rate limits apply (if they even use API keys)
- Malicious participants can spam the conversation and drain the owner's wallet

**Attack Scenario:**
```
1. User A shares conversation with "owner pays all" billing
2. User B joins via share link
3. User B sends 10,000 requests per minute
4. User A's wallet is drained completely
5. User A has no control until they notice and revoke sharing
```

**Current Code Gaps:**
- `router.py` chat completions endpoint has no conversation-aware rate limiting
- No participant-level rate limiting in `conversation_sharing.py`
- No abuse detection for participants

---

### 2. **SHARE TOKEN LEAKAGE & REUSE**
**Severity: HIGH**

**Problem:**
- Share tokens never expire
- No maximum participant limit
- Tokens can be shared on public forums/social media
- No way to detect if token has been leaked
- Owner cannot revoke individual tokens (only disable all sharing)

**Attack Scenario:**
```
1. User shares conversation privately
2. Recipient posts link to Reddit/Twitter
3. Thousands of users join
4. Original sharer has massive unexpected costs
5. Token remains valid forever
```

**Current Code Gaps:**
- `migration_008_shared_conversations.sql` has no expiration fields
- `conversation_sharing.py` doesn't track token usage metrics
- No participant limit enforcement

---

### 3. **BILLING ENFORCEMENT NOT IMPLEMENTED**
**Severity: CRITICAL**

**Problem:**
- The `share_billing` field exists but is NOT enforced anywhere
- ALL costs currently go to conversation owner regardless of setting
- Individual billing mode doesn't deduct from participant wallets
- No wallet validation for participants in "individual" mode

**Current Code:**
```python
# In router.py - NO billing logic for shared conversations!
@router.post("/chat/completions")
async def chat_completions(request, authorization):
    user = await authenticate_request(authorization)
    # ... routing logic ...

    # ALWAYS deducts from authenticated user
    await deduct_from_wallet(supabase, user["id"], actual_cost)

    # MISSING: Check if this is a shared conversation
    # MISSING: Check billing mode (owner vs individual)
    # MISSING: Deduct from correct user based on billing mode
```

**Attack Scenario:**
```
1. User A shares conversation with "individual pays" mode
2. User B joins and sends expensive requests
3. Costs are deducted from User A (wrong person!)
4. User B gets free API usage
```

---

### 4. **INSUFFICIENT ACCESS CONTROL**
**Severity: MEDIUM**

**Problem:**
- Participants can view ALL messages (including before they joined)
- No message-level permissions
- View-only participants can potentially still send if they bypass frontend
- No audit log of participant actions

**Privacy Issue:**
```
1. User A has private conversation with sensitive data
2. User A shares conversation with User B
3. User B can see ENTIRE conversation history
4. No way to hide pre-sharing messages
```

---

### 5. **NO ABUSE PREVENTION**
**Severity: HIGH**

**Problem:**
- No detection of suspicious patterns
- No automatic blocking of abusive participants
- No notification to owner when costs spike
- No emergency "pause sharing" feature

**Attack Patterns Not Detected:**
- Participant sending identical messages repeatedly
- Participant joining and immediately sending 100+ messages
- Participant sending expensive long-context requests
- Coordinated attacks from multiple accounts

---

## Security Implementation Plan

### Phase 1: Rate Limiting (CRITICAL - Implement First)

#### 1.1 Per-Participant Rate Limits
**File: `backend_code/API/shared_conversation_rate_limiter.py`** (NEW)

```python
async def check_participant_rate_limit(
    supabase,
    conversation_id: str,
    user_id: str,
    is_owner: bool
) -> Tuple[bool, Optional[str]]:
    """
    Rate limit participants in shared conversations.

    Limits:
    - Owners: No limits (or use their API key limits)
    - Chat participants: 10 RPM, 100 RPH, 500 RPD
    - View participants: Should never reach this (frontend blocks)

    Returns (is_allowed, error_message)
    """
```

#### 1.2 Conversation-Level Rate Limits
```python
async def check_conversation_rate_limit(
    supabase,
    conversation_id: str
) -> Tuple[bool, Optional[str]]:
    """
    Prevent conversation-wide abuse.

    Limits:
    - Max 100 messages per minute total (all participants combined)
    - Max 1000 messages per hour total

    Prevents coordinated attacks from multiple accounts.
    """
```

#### 1.3 Integration Point
**Modify: `backend_code/API/router.py`**

```python
@router.post("/chat/completions")
async def chat_completions(request, authorization):
    user = await authenticate_request(authorization)

    # NEW: Check if this is a shared conversation
    if hasattr(request, 'conversation_id') and request.conversation_id:
        # Check participant permission
        participant = get_participant(supabase, request.conversation_id, user["id"])

        if participant:
            # Apply participant rate limits
            allowed, error = await check_participant_rate_limit(
                supabase, request.conversation_id, user["id"],
                is_owner=participant.get("is_owner")
            )
            if not allowed:
                raise HTTPException(status_code=429, detail=error)

            # Apply conversation-wide rate limits
            allowed, error = await check_conversation_rate_limit(
                supabase, request.conversation_id
            )
            if not allowed:
                raise HTTPException(status_code=429, detail=error)
```

---

### Phase 2: Share Token Security

#### 2.1 Token Expiration
**Migration: `migration_009_share_token_security.sql`**

```sql
-- Add expiration and usage tracking
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS share_max_participants INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS share_join_count INTEGER DEFAULT 0;

-- Add token usage tracking
CREATE TABLE IF NOT EXISTS share_token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL,
    joined_user_id UUID REFERENCES auth.users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    join_ip TEXT,
    join_user_agent TEXT
);
```

#### 2.2 Token Validation Updates
**Modify: `backend_code/API/conversation_sharing.py`**

```python
async def join_shared_conversation(
    supabase,
    user_id: str,
    share_token: str,
    join_ip: str = None,
    join_user_agent: str = None
) -> Dict[str, Any]:
    """Join with enhanced security checks."""

    def _join():
        # Find conversation
        conv = supabase.table("conversations").select("*").eq(
            "share_token", share_token
        ).eq("is_shared", True).execute()

        if not conv.data:
            raise Exception("Invalid or expired share link")

        conversation = conv.data[0]

        # NEW: Check expiration
        if conversation.get("share_expires_at"):
            if datetime.now(timezone.utc) > datetime.fromisoformat(conversation["share_expires_at"]):
                raise Exception("Share link has expired")

        # NEW: Check participant limit
        participant_count = supabase.table("conversation_participants").select(
            "id", count="exact"
        ).eq("conversation_id", conversation["id"]).eq("is_active", True).execute()

        max_participants = conversation.get("share_max_participants", 10)
        if participant_count.count >= max_participants:
            raise Exception(f"Maximum participants ({max_participants}) reached")

        # NEW: Log join event
        supabase.table("share_token_usage").insert({
            "conversation_id": conversation["id"],
            "share_token": share_token,
            "joined_user_id": user_id,
            "join_ip": join_ip,
            "join_user_agent": join_user_agent
        }).execute()

        # Increment join count
        supabase.table("conversations").update({
            "share_join_count": conversation.get("share_join_count", 0) + 1
        }).eq("id", conversation["id"]).execute()

        # Add participant...
        return conversation

    return await asyncio.to_thread(_join)
```

#### 2.3 Token Rotation
**New endpoint in `router.py`:**

```python
@router.post("/conversations/{conversation_id}/share/rotate")
async def rotate_share_token(conversation_id: str, authorization: str = Header(None)):
    """
    Rotate share token to revoke old links.
    All existing participants keep access, but old token stops working.
    """
    user = await authenticate_request(authorization)

    # Generate new token
    new_token = await rotate_token(supabase, user["id"], conversation_id)

    return {
        "new_token": new_token,
        "share_url": f"{window.location.origin}?share={new_token}",
        "message": "Old share links are now invalid"
    }
```

---

### Phase 3: Billing Enforcement

#### 3.1 Billing Logic
**File: `backend_code/API/shared_conversation_billing.py`** (NEW)

```python
async def determine_billing_user(
    supabase,
    conversation_id: str,
    requesting_user_id: str
) -> Dict[str, Any]:
    """
    Determine who should be billed for a message in a shared conversation.

    Returns:
        {
            "billing_user_id": "...",
            "billing_mode": "owner" | "individual",
            "is_owner": bool
        }
    """

    # Get conversation
    conv = supabase.table("conversations").select(
        "id, user_id, share_billing"
    ).eq("id", conversation_id).execute()

    if not conv.data:
        raise Exception("Conversation not found")

    conversation = conv.data[0]
    billing_mode = conversation.get("share_billing", "owner")

    if billing_mode == "owner":
        # Owner pays for all messages
        return {
            "billing_user_id": conversation["user_id"],
            "billing_mode": "owner",
            "is_owner": conversation["user_id"] == requesting_user_id
        }
    else:
        # Individual pays for their own messages
        return {
            "billing_user_id": requesting_user_id,
            "billing_mode": "individual",
            "is_owner": conversation["user_id"] == requesting_user_id
        }


async def validate_participant_can_pay(
    supabase,
    user_id: str,
    estimated_cost: Decimal
) -> bool:
    """
    For individual billing mode, verify participant has funds.
    """
    balance = await get_wallet_balance(supabase, user_id)
    return balance >= estimated_cost
```

#### 3.2 Integration in Chat Endpoint
**Modify: `backend_code/API/router.py`**

```python
@router.post("/chat/completions")
async def chat_completions(request, authorization):
    user = await authenticate_request(authorization)

    # Determine who should be billed
    billing_user_id = user["id"]  # Default

    if hasattr(request, 'conversation_id') and request.conversation_id:
        # This is a shared conversation
        billing_info = await determine_billing_user(
            supabase, request.conversation_id, user["id"]
        )

        billing_user_id = billing_info["billing_user_id"]

        # For individual billing, check participant has funds BEFORE making request
        if billing_info["billing_mode"] == "individual" and not billing_info["is_owner"]:
            # Estimate cost (rough - assume 1000 tokens at $0.01)
            estimated_cost = Decimal("0.01")
            can_pay = await validate_participant_can_pay(supabase, user["id"], estimated_cost)

            if not can_pay:
                raise HTTPException(
                    status_code=402,
                    detail="Insufficient funds. This conversation uses individual billing - please add funds to your wallet."
                )

    # ... make inference request ...

    # Deduct from correct user
    await deduct_from_wallet(supabase, billing_user_id, actual_cost)

    # Log with billing info
    await log_api_usage(
        supabase=supabase,
        user_id=billing_user_id,  # Billed user
        actual_user_id=user["id"],  # Requesting user (for audit)
        conversation_id=request.conversation_id,
        # ... other fields ...
    )
```

---

### Phase 4: Abuse Prevention

#### 4.1 Abuse Detection
**File: `backend_code/API/abuse_detection.py`** (NEW)

```python
async def detect_participant_abuse(
    supabase,
    conversation_id: str,
    user_id: str,
    message_content: str
) -> Dict[str, Any]:
    """
    Detect abusive patterns from participants.

    Returns:
        {
            "is_abuse": bool,
            "reason": str,
            "action": "warn" | "block" | "alert_owner"
        }
    """

    # Get recent messages from this participant
    recent_messages = supabase.table("messages").select("*").eq(
        "conversation_id", conversation_id
    ).eq("user_id", user_id).gte(
        "created_at", (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    ).execute()

    # Pattern 1: Identical messages (spam)
    if len(recent_messages.data) >= 5:
        contents = [msg.get("content") for msg in recent_messages.data]
        if len(set(contents)) == 1:
            return {
                "is_abuse": True,
                "reason": "Sending identical messages repeatedly",
                "action": "block"
            }

    # Pattern 2: Rapid messages (>20 in 1 minute)
    if len(recent_messages.data) >= 20:
        return {
            "is_abuse": True,
            "reason": "Sending messages too rapidly",
            "action": "warn"
        }

    # Pattern 3: Very long messages (>10k tokens)
    token_estimate = len(message_content) / 4
    if token_estimate > 10000:
        return {
            "is_abuse": True,
            "reason": "Message is excessively long",
            "action": "alert_owner"
        }

    return {"is_abuse": False}


async def notify_owner_of_abuse(
    supabase,
    conversation_id: str,
    abusive_user_id: str,
    reason: str
):
    """
    Notify conversation owner of abusive behavior.
    Could send email, in-app notification, etc.
    """
    pass
```

#### 4.2 Cost Spike Detection
```python
async def check_cost_spike(
    supabase,
    conversation_id: str,
    owner_id: str
) -> bool:
    """
    Alert owner if shared conversation costs spike unexpectedly.

    Returns True if spike detected and notification sent.
    """

    # Get costs from last hour
    usage = supabase.table("api_usage").select("cost").eq(
        "conversation_id", conversation_id
    ).gte(
        "timestamp", (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    ).execute()

    total_cost = sum(Decimal(str(row["cost"])) for row in usage.data)

    # If >$5 in last hour, alert
    if total_cost > Decimal("5.00"):
        await notify_owner_of_cost_spike(supabase, owner_id, conversation_id, total_cost)
        return True

    return False
```

#### 4.3 Emergency Pause
**New endpoint:**

```python
@router.post("/conversations/{conversation_id}/emergency-pause")
async def emergency_pause_sharing(conversation_id: str, authorization: str = Header(None)):
    """
    Immediately pause all participant access (owner only).
    Keeps conversation shared but blocks all non-owner messages.
    """
    user = await authenticate_request(authorization)

    # Verify ownership
    conv = supabase.table("conversations").select("user_id").eq(
        "id", conversation_id
    ).eq("user_id", user["id"]).execute()

    if not conv.data:
        raise HTTPException(status_code=403, detail="Only owner can pause")

    # Set all participants to inactive
    supabase.table("conversation_participants").update({
        "is_active": False,
        "paused_at": datetime.now(timezone.utc).isoformat()
    }).eq("conversation_id", conversation_id).execute()

    return {
        "paused": True,
        "message": "All participant access temporarily suspended"
    }
```

---

## Additional Security Measures

### 1. Share Link Best Practices (Frontend)

**Modify: `frontend/collaboration.js`**

```javascript
// Add expiration and participant limit options
function showShareModal(conversationId) {
    // ... existing code ...

    // Add new fields:
    <div>
        <label>Link Expires In</label>
        <select id="share-expiration">
            <option value="">Never</option>
            <option value="1h">1 Hour</option>
            <option value="24h">24 Hours</option>
            <option value="7d" selected>7 Days</option>
            <option value="30d">30 Days</option>
        </select>
    </div>

    <div>
        <label>Max Participants</label>
        <input type="number" id="share-max-participants"
               value="10" min="1" max="100">
    </div>

    <div>
        <label>
            <input type="checkbox" id="share-require-approval">
            Require owner approval for new participants
        </label>
    </div>
}
```

### 2. Audit Logging

**Migration:**
```sql
CREATE TABLE IF NOT EXISTS conversation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,  -- 'join', 'leave', 'message_sent', 'permission_changed', 'removed'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Rate Limit Response Headers

Add standard rate limit headers to all responses:

```python
response.headers["X-RateLimit-Limit"] = str(rate_limit)
response.headers["X-RateLimit-Remaining"] = str(remaining)
response.headers["X-RateLimit-Reset"] = reset_time.isoformat()
```

---

## Implementation Priority

### IMMEDIATE (This Week)
1. ✅ Participant rate limiting
2. ✅ Billing enforcement (owner vs individual)
3. ✅ Basic abuse detection (spam, rapid messages)

### HIGH PRIORITY (Next Week)
4. ✅ Share token expiration
5. ✅ Participant limits
6. ✅ Token rotation endpoint
7. ✅ Emergency pause feature

### MEDIUM PRIORITY (Next 2 Weeks)
8. ✅ Cost spike detection & notifications
9. ✅ Audit logging
10. ✅ Token usage tracking

### LOW PRIORITY (Nice to Have)
11. Require approval for participants
12. Message-level permissions (hide pre-sharing messages)
13. Advanced abuse detection (ML-based)
14. Participant reputation system

---

## Security Checklist

Before deploying shared conversations to production:

- [ ] Participant rate limits enforced
- [ ] Billing mode correctly applied (owner vs individual)
- [ ] Share tokens expire
- [ ] Maximum participant count enforced
- [ ] Token rotation available
- [ ] Emergency pause works
- [ ] Cost spike alerts configured
- [ ] Abuse detection active
- [ ] Audit logs enabled
- [ ] RLS policies tested
- [ ] Load testing with malicious participants
- [ ] Security review completed

---

## Testing Scenarios

### Test 1: Billing Enforcement
```bash
# Create shared conversation with "individual pays"
# Have participant send message
# Verify cost deducted from participant, not owner
```

### Test 2: Rate Limit Abuse
```bash
# Join shared conversation as participant
# Send 100 requests per minute
# Verify rate limit blocks after threshold
```

### Test 3: Token Expiration
```bash
# Share conversation with 1-hour expiration
# Wait 1 hour
# Attempt to join with expired token
# Verify rejection
```

### Test 4: Emergency Pause
```bash
# Share conversation
# Have participant join
# Owner triggers emergency pause
# Verify participant cannot send messages
```

---

**Last Updated:** 2025-12-31
**Status:** ANALYSIS COMPLETE - IMPLEMENTATION PENDING
