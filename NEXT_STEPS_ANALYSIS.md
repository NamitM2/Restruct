# Restruct - Next Steps Analysis
**Date:** January 23, 2026  
**Comprehensive Codebase Review & Roadmap**

---

## 🎯 Executive Summary

Restruct is an **intelligent LLM routing platform** that learns from real performance data to select the best model for each request. The codebase is well-structured with:
- ✅ Full-stack web application (FastAPI + vanilla JS)
- ✅ OpenAI-compatible API with authentication
- ✅ Wallet system & usage tracking
- ✅ Community routing profiles
- ✅ Conversation management with sharing
- ✅ API key management with rate limiting

**Current Status:** MVP is feature-complete but has several areas for improvement and expansion.

---

## 📊 Current Architecture Overview

### Backend (Python/FastAPI)
- **Core Routing:** `router.py` - LLM-based routing using Gemini (local Phi router disabled)
- **Inference:** `inference.py` - Multi-provider LLM calls (OpenAI, Anthropic, Google)
- **Models Config:** `models_config.py` - 11 models across 3 providers (GPT-5, Gemini 2.5, Claude 4)
- **API Layer:** OpenAI-compatible `/v1/chat/completions` endpoint
- **Database:** Supabase (PostgreSQL) with RLS policies
- **Wallet System:** Cost tracking, balance management, usage logging
- **API Keys:** Long-lived authentication with expiration support

### Frontend (Vanilla JS/HTML/CSS)
- **Main App:** `index.html` + `script.js` (5,322 lines)
- **Routing Lab:** Visual profile builder (`routingLabProfileBuilder.js`)
- **Landing Page:** New experimental design (`Home.html`)
- **Auth:** Sign-in/sign-up with Supabase Auth
- **Features:** Chat interface, conversation history, statistics, billing, API key management

### Database Schema
- `profiles` - User data
- `conversations` + `messages` - Chat history
- `routing_profiles` - Custom routing configurations
- `user_wallets` - Balance tracking
- `api_usage` - Request logging
- `api_keys` - Authentication tokens
- `shared_conversations` - Conversation sharing with permissions

---

## 🚨 Critical Issues to Fix

### 1. **Local Router Disabled (GPU Support)**
**Priority:** HIGH  
**Location:** `backend_code/router.py:115`, `backend_code/app.py:440`

**Problem:**
```python
# Local PHI router disabled - using Gemini API for routing
# TODO: Re-enable when GPU support is configured
```

**Impact:**
- Every routing decision costs money (Gemini API calls)
- Slower routing (~150ms vs ~50ms)
- Dependency on external API for core functionality

**Solution:**
1. **Option A - Enable CPU-based local routing:**
   - Test `local_llm_router.py` with CPU inference
   - Measure latency impact (likely 200-500ms on CPU)
   - If acceptable, re-enable in `router.py`

2. **Option B - Add GPU detection & fallback:**
   ```python
   try:
       router = get_local_router()
       if router.is_ready() and router.has_gpu():
           scores = route_with_phi(conversation)
       else:
           scores = await route_with_gemini(conversation)
   except:
       scores = await route_with_gemini(conversation)
   ```

3. **Option C - Hybrid approach:**
   - Use local router for simple prompts (< 300 tokens)
   - Use Gemini for complex prompts (> 300 tokens)
   - Best of both worlds: cost + quality

**Estimated Effort:** 2-4 hours

---

### 2. **Embedding-Based Router Experiment Incomplete**
**Priority:** MEDIUM  
**Location:** `backend_code/experiments/embedding_router.py`

**Problem:**
- Experimental embedding-based routing exists but isn't integrated
- Could provide better routing than LLM-based approach
- No benchmark data to compare against

**Current State:**
- ✅ Code is complete and functional
- ✅ Uses sentence-transformers for embeddings
- ❌ Not integrated into main routing flow
- ❌ No performance comparison data

**Solution:**
1. **Run comparative benchmark:**
   ```bash
   python backend_code/experiments/embedding_router.py
   ```
   - Test on 100 diverse prompts
   - Compare routing decisions vs LLM-based router
   - Measure: accuracy, latency, cost

2. **If promising, integrate as option:**
   ```python
   # In router.py
   async def route_with_llm(conversation, method="gemini"):
       if method == "embedding":
           return route_with_embeddings(conversation)
       elif method == "phi":
           return route_with_phi(conversation)
       else:
           return await route_with_gemini(conversation)
   ```

**Estimated Effort:** 4-6 hours

---

### 3. **No Benchmark Database Implementation**
**Priority:** HIGH (for production)  
**Location:** Missing - referenced in `ROUTING_ARCHITECTURE.md`

**Problem:**
The entire routing architecture document describes a sophisticated benchmark-based system:
- Store complete model rankings per prompt
- Vector similarity search for routing
- Feedback loop for continuous improvement

**Current Reality:**
- ❌ No `benchmark_prompts` table
- ❌ No `model_rankings` table
- ❌ No vector embeddings stored
- ❌ No similarity search
- ❌ Routing is purely LLM-based (no learning from data)

**This is a MAJOR gap** between the vision and implementation.

**Solution - Phased Approach:**

**Phase 1: Minimal Viable Benchmark (1-2 weeks)**
1. Create database tables:
   ```sql
   CREATE TABLE benchmark_prompts (
       id UUID PRIMARY KEY,
       prompt TEXT NOT NULL,
       embedding VECTOR(1536),
       task_type VARCHAR(50),
       created_at TIMESTAMPTZ
   );
   
   CREATE TABLE model_rankings (
       id UUID PRIMARY KEY,
       prompt_id UUID REFERENCES benchmark_prompts(id),
       model_name VARCHAR(100),
       quality_score DECIMAL(3,2),
       cost DECIMAL(10,8),
       latency_ms INT,
       tokens_in INT,
       tokens_out INT,
       created_at TIMESTAMPTZ
   );
   ```

2. Seed with initial data:
   - Use existing `api_usage` table data
   - Generate embeddings for past prompts
   - Calculate quality scores (user feedback or LLM-as-judge)

3. Implement similarity search:
   - Use pgvector extension in Supabase
   - Find top-K similar prompts
   - Aggregate model rankings

**Phase 2: Feedback Loop (2-3 weeks)**
1. Add user feedback UI (thumbs up/down)
2. Update rankings based on feedback
3. A/B test: benchmark-based vs LLM-based routing

**Phase 3: Continuous Learning (ongoing)**
1. Automated quality scoring
2. Drift detection
3. New model integration pipeline

**Estimated Effort:** 3-6 weeks for full implementation

---

## 🎨 Frontend Improvements

### 4. **Statistics Dashboard Shows Mock Data**
**Priority:** MEDIUM  
**Location:** `frontend/script.js`, `frontend/statistics.js`

**Problem:**
- Statistics page exists but shows placeholder data
- Real data is in `api_usage` table but not connected
- Users can't see actual usage patterns

**Solution:**
1. Connect to `/v1/usage` endpoint (already exists!)
2. Calculate real metrics:
   - Token usage over time
   - Cost breakdown by model
   - Request count by profile
   - Average latency trends

3. Add visualizations:
   - Use Chart.js or similar
   - Time-series graphs
   - Model distribution pie chart
   - Cost vs quality scatter plot

**Estimated Effort:** 6-8 hours

---

### 5. **Profile Builder Missing Rate Limit UI**
**Priority:** LOW  
**Location:** `frontend/routingLabProfileBuilder.js`

**Problem:**
- Backend supports rate limits (`rate_limit_rpm`, `rate_limit_rph`, `rate_limit_rpd`)
- UI has no fields to set these values
- Users can't configure rate limiting

**Solution:**
Add input fields to profile builder:
```javascript
// In profile builder form
<div class="rate-limits-section">
    <h3>Rate Limits</h3>
    <input type="number" id="rateLimitRpm" placeholder="Requests per minute">
    <input type="number" id="rateLimitRph" placeholder="Requests per hour">
    <input type="number" id="rateLimitRpd" placeholder="Requests per day">
</div>
```

**Estimated Effort:** 2-3 hours

---

### 6. **API Key Expiration UI Missing**
**Priority:** LOW  
**Location:** `frontend/script.js` (API key modal)

**Problem:**
- Backend supports `expires_at` parameter
- UI has no date picker to set expiration
- Users create keys that never expire

**Solution:**
Add date picker to API key generation modal:
```html
<div class="expiration-section">
    <label>Expiration Date (optional)</label>
    <input type="datetime-local" id="keyExpiration">
    <select id="expirationPreset">
        <option value="">Never</option>
        <option value="30">30 days</option>
        <option value="60">60 days</option>
        <option value="90">90 days</option>
    </select>
</div>
```

**Estimated Effort:** 2-3 hours

---

## 🚀 New Features to Implement

### 7. **Conversation Sharing Enhancement**
**Priority:** MEDIUM  
**Current State:** Basic sharing exists, needs polish

**Improvements:**
1. **Public link generation:**
   - One-click "Share" button in chat
   - Generate shareable URL
   - Copy to clipboard

2. **Permission management UI:**
   - View-only vs comment vs edit
   - Time-limited access
   - Revoke access

3. **Shared conversation viewer:**
   - Dedicated page for viewing shared chats
   - No login required for view-only
   - Clean, minimal UI

**Estimated Effort:** 8-12 hours

---

### 8. **Model Performance Dashboard**
**Priority:** HIGH (for credibility)

**Purpose:** Show users WHY Restruct's routing is better

**Features:**
1. **Model comparison table:**
   - Quality scores by task type
   - Cost per 1K tokens
   - Average latency
   - Success rate

2. **Routing decision explanations:**
   - Show why a model was chosen
   - Display alternative models considered
   - Explain trade-offs (cost vs quality)

3. **Personal usage insights:**
   - "You saved $X this month by using Restruct"
   - "Your most-used model: GPT-5"
   - "Average quality score: 4.7/5"

**Estimated Effort:** 12-16 hours

---

### 9. **Batch Processing API**
**Priority:** MEDIUM  
**Current State:** Web app has `/chat/batch`, but not in OpenAI-compatible API

**Use Case:**
- Process 100s of prompts efficiently
- Useful for data labeling, content generation
- Competitive with OpenRouter's batch API

**Implementation:**
```python
# POST /v1/batch
{
    "requests": [
        {"model": "auto", "messages": [...]},
        {"model": "auto", "messages": [...]},
        # ... up to 1000 requests
    ]
}

# Response
{
    "results": [
        {"id": 0, "response": {...}, "cost": 0.002},
        {"id": 1, "response": {...}, "cost": 0.001},
    ],
    "total_cost": 0.003,
    "total_time_ms": 5432
}
```

**Estimated Effort:** 6-8 hours

---

### 10. **Streaming Support in API**
**Priority:** HIGH (for UX)

**Problem:**
- Web app has streaming
- OpenAI-compatible API doesn't expose it
- Users expect streaming for long responses

**Solution:**
```python
# In backend_code/API/router.py
@router.post("/v1/chat/completions")
async def chat_completions(...):
    if request.stream:
        return StreamingResponse(
            stream_completion(...),
            media_type="text/event-stream"
        )
    else:
        return await non_streaming_completion(...)
```

**Estimated Effort:** 4-6 hours

---

## 💰 Monetization Features

### 11. **Real Payment Integration**
**Priority:** HIGH (for launch)  
**Current State:** Test-only "Add Funds" button

**Options:**

**Option A: Stripe Integration**
- Most popular, well-documented
- Supports subscriptions + one-time payments
- 2.9% + $0.30 per transaction

**Option B: Crypto Payments**
- Lower fees (~1%)
- Appeals to tech-savvy users
- More complex integration

**Recommended: Stripe**

**Implementation:**
1. Create Stripe account
2. Add Stripe.js to frontend
3. Create payment intent endpoint
4. Handle webhooks for payment confirmation
5. Update wallet balance on success

**Estimated Effort:** 12-16 hours

---

### 12. **Subscription Tiers**
**Priority:** MEDIUM  
**Purpose:** Predictable revenue vs pay-as-you-go

**Proposed Tiers:**

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0/mo | $5 free credits, basic models only |
| **Starter** | $20/mo | $25 credits/mo, all models, basic support |
| **Pro** | $50/mo | $75 credits/mo, priority routing, advanced analytics |
| **Enterprise** | Custom | Unlimited, dedicated support, custom models |

**Implementation:**
- Add `subscription_tier` to `profiles` table
- Check tier in middleware
- Restrict features based on tier
- Stripe subscription management

**Estimated Effort:** 16-20 hours

---

### 13. **Referral Program**
**Priority:** LOW (growth hack)

**Concept:**
- "Refer a friend, get $5 credit"
- Friend gets $5 credit too
- Tracked via unique referral codes

**Implementation:**
1. Add `referral_code` to `profiles`
2. Track referrals in `referrals` table
3. Award credits on signup
4. Display referral stats in dashboard

**Estimated Effort:** 8-10 hours

---

## 🔧 Technical Debt & Code Quality

### 14. **Test Coverage**
**Priority:** HIGH (before scaling)  
**Current State:** Minimal tests

**What's Missing:**
- Unit tests for routing logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Load testing for scalability

**Action Items:**
1. Add pytest tests for:
   - `router.py` - routing decisions
   - `inference.py` - provider calls
   - `wallet.py` - cost calculations

2. Add frontend tests (Vitest):
   - Profile builder logic
   - Chat message handling
   - API key management

3. Add E2E tests (Playwright):
   - Sign up → create profile → chat
   - Generate API key → make API call
   - Add funds → check balance

**Estimated Effort:** 20-30 hours

---

### 15. **Error Handling & Logging**
**Priority:** MEDIUM

**Problems:**
- Generic error messages to users
- No centralized logging
- Hard to debug production issues

**Solutions:**
1. **Structured logging:**
   ```python
   import structlog
   logger = structlog.get_logger()
   logger.info("routing_decision", model=model, cost=cost, latency=latency)
   ```

2. **Error tracking:**
   - Integrate Sentry or similar
   - Capture exceptions with context
   - Alert on critical errors

3. **User-friendly errors:**
   - Don't expose internal errors
   - Provide actionable messages
   - Include support contact

**Estimated Effort:** 8-12 hours

---

### 16. **Code Organization**
**Priority:** LOW (nice-to-have)

**Issues:**
- `script.js` is 5,322 lines (too large)
- Mixed concerns (auth, chat, profiles, billing)
- Hard to maintain

**Refactoring:**
```
frontend/
  ├── modules/
  │   ├── auth.js          (login, signup, session)
  │   ├── chat.js          (messages, streaming)
  │   ├── profiles.js      (routing profiles)
  │   ├── billing.js       (wallet, payments)
  │   ├── apiKeys.js       (key management)
  │   └── statistics.js    (dashboard)
  ├── utils/
  │   ├── api.js           (fetch wrappers)
  │   └── ui.js            (modals, themes)
  └── main.js              (initialization)
```

**Estimated Effort:** 16-20 hours

---

## 🌟 Competitive Features

### 17. **Prompt Caching**
**Priority:** MEDIUM  
**Purpose:** Reduce costs for repeated prompts

**How it works:**
1. Hash prompt + model + parameters
2. Check cache (Redis or Supabase)
3. If hit, return cached response
4. If miss, call LLM and cache result

**Benefits:**
- 10-100x faster for cached prompts
- Zero cost for cache hits
- Better UX for common queries

**Estimated Effort:** 8-12 hours

---

### 18. **Multi-Model Responses**
**Priority:** LOW (differentiator)

**Concept:**
- Send prompt to 3 models simultaneously
- Show all responses side-by-side
- User picks best one
- System learns from preference

**Use Case:**
- Critical decisions (legal, medical)
- Creative work (compare writing styles)
- Benchmarking models

**Implementation:**
```javascript
// Frontend
const responses = await fetch('/v1/chat/multi', {
    body: JSON.stringify({
        models: ["gpt-5", "claude-opus-4-1", "gemini-2.5-pro"],
        messages: [...]
    })
});

// Backend
async def multi_model_chat(...):
    tasks = [call_model(m, messages) for m in models]
    results = await asyncio.gather(*tasks)
    return {"responses": results}
```

**Estimated Effort:** 10-12 hours

---

### 19. **Custom Model Integration**
**Priority:** LOW (enterprise feature)

**Allow users to:**
- Add their own API keys
- Use their own fine-tuned models
- Route to self-hosted models

**Implementation:**
1. Add `user_models` table
2. UI to add custom models
3. Include in routing decisions
4. Secure API key storage (encrypted)

**Estimated Effort:** 12-16 hours

---

## 📈 Analytics & Insights

### 20. **Admin Dashboard**
**Priority:** MEDIUM (for operations)

**Metrics to track:**
- Daily active users
- Total API requests
- Revenue (wallet top-ups)
- Most popular models
- Average response time
- Error rates

**Tools:**
- Build custom dashboard in app
- Or use Metabase/Grafana + Supabase

**Estimated Effort:** 12-16 hours

---

### 21. **User Feedback System**
**Priority:** MEDIUM (for quality)

**Features:**
1. **Thumbs up/down on responses**
   - Already in UI, needs backend
   - Store in `message_feedback` table
   - Use for model ranking

2. **Detailed feedback form:**
   - "Why was this response bad?"
   - Options: inaccurate, slow, expensive, unhelpful
   - Free-text comments

3. **Feedback dashboard:**
   - Show aggregate feedback
   - Identify problematic models
   - Track improvement over time

**Estimated Effort:** 8-10 hours

---

## 🔒 Security & Compliance

### 22. **Rate Limiting (Global)**
**Priority:** HIGH (prevent abuse)  
**Current State:** Per-profile rate limiting exists

**Add:**
- Global rate limits per user
- IP-based rate limiting
- API key rate limiting (separate from profile)

**Implementation:**
```python
# In middleware
@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    client_ip = request.client.host
    if await is_rate_limited(client_ip):
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded"}
        )
    return await call_next(request)
```

**Estimated Effort:** 4-6 hours

---

### 23. **Data Privacy Compliance**
**Priority:** HIGH (for EU users)

**GDPR Requirements:**
- ✅ User can delete account (cascade delete)
- ❌ Data export functionality
- ❌ Privacy policy page
- ❌ Cookie consent banner
- ❌ Data retention policy

**Action Items:**
1. Add `/v1/user/export` endpoint (JSON dump)
2. Create privacy policy page
3. Add cookie consent (if using analytics)
4. Document data retention (30 days? 1 year?)

**Estimated Effort:** 8-12 hours

---

### 24. **API Key Security Enhancements**
**Priority:** MEDIUM

**Current Issues:**
- Keys stored in plaintext (hashed prefix only)
- No IP whitelisting
- No usage alerts

**Improvements:**
1. **IP Whitelisting:**
   - Allow users to restrict key to specific IPs
   - Useful for production deployments

2. **Usage Alerts:**
   - Email when key usage spikes
   - Alert on suspicious activity
   - Daily/weekly usage reports

3. **Key Rotation:**
   - Suggest rotating keys every 90 days
   - One-click rotation (old key valid for 24h)

**Estimated Effort:** 10-12 hours

---

## 🎯 Prioritized Roadmap

### Phase 1: Critical Fixes (1-2 weeks)
1. ✅ Fix local router (GPU support or hybrid approach)
2. ✅ Implement benchmark database (minimal version)
3. ✅ Add streaming to API
4. ✅ Connect statistics to real data

### Phase 2: Core Features (2-3 weeks)
5. ✅ Real payment integration (Stripe)
6. ✅ Model performance dashboard
7. ✅ User feedback system
8. ✅ Global rate limiting
9. ✅ Test coverage (critical paths)

### Phase 3: Growth Features (3-4 weeks)
10. ✅ Subscription tiers
11. ✅ Batch processing API
12. ✅ Conversation sharing polish
13. ✅ Prompt caching
14. ✅ Admin dashboard

### Phase 4: Differentiation (ongoing)
15. ✅ Multi-model responses
16. ✅ Custom model integration
17. ✅ Referral program
18. ✅ Advanced analytics

---

## 💡 Quick Wins (Do First)

These can be done in < 4 hours each and provide immediate value:

1. **Enable local router with CPU fallback** (2-3 hours)
2. **Add rate limit UI to profile builder** (2-3 hours)
3. **Connect statistics dashboard to real data** (3-4 hours)
4. **Add API key expiration date picker** (2-3 hours)
5. **Implement user feedback thumbs up/down** (3-4 hours)
6. **Add global rate limiting** (3-4 hours)

**Total: ~15-20 hours for 6 major improvements**

---

## 🎨 Design Improvements

### Landing Page
- ✅ New experimental design exists (`Home.html`)
- ❌ Not fully integrated
- ❌ Missing: pricing section, testimonials, demo video

### Chat Interface
- ✅ Functional and clean
- ❌ Could use: message editing, regenerate response, export chat

### Profile Builder
- ✅ Visual graph builder is impressive
- ❌ Could use: templates, import/export, sharing

---

## 📝 Documentation Needs

### For Users:
1. **Getting Started Guide** - Step-by-step tutorial
2. **API Documentation** - Complete endpoint reference
3. **Profile Builder Tutorial** - How to create custom profiles
4. **Best Practices** - Tips for cost optimization

### For Developers:
1. **Architecture Overview** - System design doc
2. **Contributing Guide** - How to add new models/providers
3. **Testing Guide** - How to run tests
4. **Deployment Guide** - Production setup

**Estimated Effort:** 12-16 hours

---

## 🚀 Launch Checklist

Before going live:

### Technical
- [ ] Fix local router or optimize Gemini costs
- [ ] Implement benchmark database (at least Phase 1)
- [ ] Add comprehensive error handling
- [ ] Set up monitoring (Sentry, uptime checks)
- [ ] Load testing (can handle 100 concurrent users?)
- [ ] Backup strategy (database, user data)

### Business
- [ ] Stripe integration complete
- [ ] Pricing finalized
- [ ] Terms of Service written
- [ ] Privacy Policy written
- [ ] Support email set up
- [ ] Refund policy defined

### Marketing
- [ ] Landing page polished
- [ ] Demo video created
- [ ] Social media accounts set up
- [ ] Launch announcement drafted
- [ ] Beta user feedback collected

---

## 🎓 Learning Opportunities

### For You (Developer):
1. **Vector Databases** - Implementing pgvector for similarity search
2. **LLM Evaluation** - Building quality scoring systems
3. **Payment Processing** - Stripe integration
4. **Scalability** - Handling high-traffic routing

### For Users:
1. **Prompt Engineering** - Through routing insights
2. **Model Selection** - Understanding trade-offs
3. **Cost Optimization** - Via usage analytics

---

## 🤔 Strategic Questions

1. **Target Market:**
   - Developers building AI apps? (compete with OpenRouter)
   - Businesses wanting cost optimization? (compete with Martian)
   - Researchers comparing models? (unique positioning)

2. **Differentiation:**
   - Is "learning from data" enough?
   - Should you focus on cost savings or quality?
   - What about privacy (local models)?

3. **Pricing Strategy:**
   - Markup on LLM costs? (e.g., 10% fee)
   - Subscription + credits?
   - Free tier to attract users?

4. **Growth Strategy:**
   - Open source the routing algorithm?
   - Partner with LLM providers?
   - Build community profiles marketplace?

---

## 📊 Metrics to Track

### Product Metrics:
- **Routing Accuracy** - % of times best model was chosen
- **Cost Savings** - vs always using GPT-5
- **User Retention** - % of users active after 30 days
- **API Adoption** - % of users using API vs web app

### Business Metrics:
- **MRR** - Monthly recurring revenue
- **CAC** - Customer acquisition cost
- **LTV** - Lifetime value
- **Churn Rate** - % of users who stop using

### Technical Metrics:
- **Routing Latency** - p50, p95, p99
- **API Uptime** - 99.9% target?
- **Error Rate** - < 0.1% target?
- **Cache Hit Rate** - if implementing caching

---

## 🎉 Conclusion

**Restruct has a solid foundation** with:
- ✅ Clean architecture
- ✅ Core features working
- ✅ Good documentation
- ✅ Modern tech stack

**Key gaps to address:**
1. **Benchmark database** - Core differentiator not implemented
2. **Local routing** - Currently disabled, costing money
3. **Payment integration** - Needed for launch
4. **Test coverage** - Critical for reliability

**Recommended Next Steps:**
1. **Week 1-2:** Fix local router + implement minimal benchmark DB
2. **Week 3-4:** Add Stripe + connect statistics to real data
3. **Week 5-6:** Polish UX + add user feedback system
4. **Week 7-8:** Testing + documentation + launch prep

**Estimated time to launch-ready:** 6-8 weeks of focused work

---

**Questions? Priorities to adjust? Let's discuss!**
