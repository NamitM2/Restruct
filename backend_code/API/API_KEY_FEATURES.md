# API Key Advanced Features

## Overview

Restruct API keys now support per-key rate limiting, metadata tagging, and detailed usage analytics. These features allow you to:

- Set different rate limits for different API keys (production vs staging vs webhooks)
- Track usage and costs per API key
- Organize keys with tags, environment labels, and notes
- Monitor rate limit status in real-time
- Compare performance across multiple keys

---

## 1. Creating API Keys with Advanced Features

### Basic Key Creation

```bash
curl -X POST http://localhost:8000/v1/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Backend"
  }'
```

### With Rate Limits

```bash
curl -X POST http://localhost:8000/v1/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Backend",
    "rate_limit_rpm": 100,
    "rate_limit_rph": 5000,
    "rate_limit_rpd": 50000,
    "environment": "production",
    "application": "web-app",
    "tags": ["high-priority", "v2-api"],
    "notes": "Main production backend API key"
  }'
```

**Response:**
```json
{
  "id": "abc-123-def",
  "key": "rst_xxxxxxxxxxxxxxxxxxx",
  "key_prefix": "rst_xxxxxxxx",
  "name": "Production Backend",
  "expires_at": null,
  "created_at": "2025-01-15T10:30:00Z",
  "rate_limits": {
    "rpm": 100,
    "rph": 5000,
    "rpd": 50000
  },
  "metadata": {
    "environment": "production",
    "application": "web-app",
    "tags": ["high-priority", "v2-api"],
    "notes": "Main production backend API key"
  },
  "warning": "Save this key securely - it will not be shown again"
}
```

### Using with OpenAI SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="rst_xxxxxxxxxxxxxxxxxxx"
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

---

## 2. Rate Limiting

### How It Works

Per-key rate limits are enforced **in addition to** profile-based rate limits:

1. **Per-Key Limits** - Applied to the specific API key (e.g., 100 RPM)
2. **Profile Limits** - Applied when using a routing profile (if configured)

Both are checked before processing requests.

### Rate Limit Parameters

- `rate_limit_rpm`: Requests per minute (60-second rolling window)
- `rate_limit_rph`: Requests per hour (60-minute rolling window)
- `rate_limit_rpd`: Requests per day (24-hour rolling window)

### Example Response When Rate Limited

**HTTP 429 Too Many Requests**
```json
{
  "detail": "Rate limit exceeded: 100 requests per minute. Please retry later."
}
```

### Checking Rate Limit Status

```bash
curl http://localhost:8000/v1/keys/{key_id}/rate-limits \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "object": "rate_limit_status",
  "data": {
    "minute": {
      "current": 87,
      "limit": 100,
      "remaining": 13,
      "reset_at": "2025-01-15T10:32:00Z"
    },
    "hour": {
      "current": 2341,
      "limit": 5000,
      "remaining": 2659,
      "reset_at": "2025-01-15T11:00:00Z"
    },
    "day": {
      "current": 18234,
      "limit": 50000,
      "remaining": 31766,
      "reset_at": "2025-01-16T00:00:00Z"
    }
  }
}
```

---

## 3. Usage Analytics

### Get Key Usage Statistics

```bash
curl "http://localhost:8000/v1/keys/{key_id}/usage?time_range=7d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Query Parameters:**
- `time_range`: `24h`, `7d`, `30d`, `all` (default: `7d`)

**Response:**
```json
{
  "object": "key_usage_stats",
  "data": {
    "key_info": {
      "id": "abc-123-def",
      "name": "Production Backend",
      "key_prefix": "rst_xxxxxxxx"
    },
    "time_range": "7d",
    "summary": {
      "total_requests": 12450,
      "total_cost": 23.45,
      "total_tokens": 5234000,
      "input_tokens": 2100000,
      "output_tokens": 3134000,
      "success_rate": 99.2,
      "avg_latency_ms": 234.5
    },
    "top_models": [
      {
        "provider": "google",
        "model": "gemini-2.0-flash-lite",
        "requests": 8234,
        "cost": 12.34,
        "tokens": 3200000
      },
      {
        "provider": "openai",
        "model": "gpt-5-nano",
        "requests": 3216,
        "cost": 8.92,
        "tokens": 1800000
      }
    ],
    "top_profiles": [
      {
        "profile": "cost-optimized",
        "requests": 7000,
        "cost": 10.23
      },
      {
        "profile": "balanced",
        "requests": 4450,
        "cost": 11.22
      }
    ],
    "recent_requests": [
      {
        "timestamp": "2025-01-15T10:30:45Z",
        "provider": "google",
        "model": "gemini-2.0-flash-lite",
        "profile": "cost-optimized",
        "tokens": 2340,
        "cost": 0.0023,
        "status": 200,
        "latency_ms": 187
      }
    ]
  }
}
```

### Get Daily Timeline

```bash
curl "http://localhost:8000/v1/keys/{key_id}/timeline?days=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "object": "key_timeline",
  "data": [
    {
      "date": "2025-01-14",
      "requests": 1234,
      "cost": 3.45,
      "tokens": 523000,
      "errors": 12
    },
    {
      "date": "2025-01-15",
      "requests": 987,
      "cost": 2.78,
      "tokens": 412000,
      "errors": 5
    }
  ]
}
```

### Compare All Keys

```bash
curl "http://localhost:8000/v1/keys/compare?time_range=7d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "object": "keys_comparison",
  "data": [
    {
      "key_id": "abc-123-def",
      "name": "Production Backend",
      "key_prefix": "rst_prod123",
      "is_active": true,
      "requests": 12450,
      "cost": 23.45,
      "tokens": 5234000,
      "success_rate": 99.2
    },
    {
      "key_id": "xyz-789-ghi",
      "name": "Staging Environment",
      "key_prefix": "rst_stage45",
      "is_active": true,
      "requests": 3420,
      "cost": 5.67,
      "tokens": 1234000,
      "success_rate": 98.5
    }
  ]
}
```

---

## 4. Updating Keys

### Update Name, Limits, and Metadata

```bash
curl -X PATCH http://localhost:8000/v1/keys/{key_id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Production Key",
    "rate_limit_rpm": 200,
    "environment": "production",
    "tags": ["high-priority", "v2-api", "updated"],
    "notes": "Increased rate limit after load testing"
  }'
```

**Response:**
```json
{
  "updated": true,
  "id": "abc-123-def",
  "fields": ["name", "rate_limit_rpm", "environment", "tags", "notes"]
}
```

---

## 5. Use Cases

### Different Keys for Different Environments

```bash
# Production - high limits, strict monitoring
POST /v1/keys
{
  "name": "Production",
  "rate_limit_rpm": 1000,
  "rate_limit_rpd": 100000,
  "environment": "production",
  "tags": ["critical"]
}

# Staging - moderate limits
POST /v1/keys
{
  "name": "Staging",
  "rate_limit_rpm": 100,
  "rate_limit_rpd": 10000,
  "environment": "staging"
}

# Development - low limits
POST /v1/keys
{
  "name": "Development",
  "rate_limit_rpm": 10,
  "rate_limit_rpd": 1000,
  "environment": "development"
}
```

### Webhook Keys with Low Limits

```bash
POST /v1/keys
{
  "name": "Webhook Handler",
  "rate_limit_rpm": 5,
  "rate_limit_rph": 100,
  "application": "webhook-service",
  "tags": ["webhook", "low-priority"],
  "notes": "Processes incoming webhooks from external service"
}
```

### Mobile App Keys

```bash
POST /v1/keys
{
  "name": "iOS App",
  "rate_limit_rpm": 50,
  "application": "mobile-ios",
  "tags": ["mobile", "client-side"],
  "notes": "Embedded in iOS app v2.3+"
}
```

---

## 6. Integration Examples

### Python with OpenAI SDK

```python
from openai import OpenAI
import requests

# Configuration
API_KEY = "rst_your_key_here"
BASE_URL = "http://localhost:8000/v1"

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

# Make request
response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}]
)

print(f"Response: {response.choices[0].message.content}")
print(f"Cost: {response.restruct['cost']}")

# Check rate limit status
rate_status = requests.get(
    f"{BASE_URL}/keys/{{key_id}}/rate-limits",
    headers={"Authorization": f"Bearer {API_KEY}"}
).json()

print(f"Remaining this minute: {rate_status['data']['minute']['remaining']}")
```

### Node.js

```javascript
import OpenAI from 'openai';
import axios from 'axios';

const apiKey = 'rst_your_key_here';
const baseURL = 'http://localhost:8000/v1';

const client = new OpenAI({
  baseURL,
  apiKey
});

// Make request
const response = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: 'Hello' }]
});

console.log('Response:', response.choices[0].message.content);

// Get usage stats
const stats = await axios.get(
  `${baseURL}/keys/{key_id}/usage?time_range=24h`,
  { headers: { Authorization: `Bearer ${apiKey}` } }
);

console.log('Today\'s cost:', stats.data.data.summary.total_cost);
```

### cURL Examples

```bash
# Create key
curl -X POST http://localhost:8000/v1/keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"name":"Test","rate_limit_rpm":10}'

# Use key for chat
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hi"}]}'

# Check usage
curl http://localhost:8000/v1/keys/$KEY_ID/usage?time_range=7d \
  -H "Authorization: Bearer $JWT_TOKEN"

# Update limits
curl -X PATCH http://localhost:8000/v1/keys/$KEY_ID \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"rate_limit_rpm":20}'
```

---

## 7. Database Schema

### api_keys Table (New Columns)

```sql
-- Rate limits
rate_limit_rpm INTEGER       -- Requests per minute
rate_limit_rph INTEGER       -- Requests per hour
rate_limit_rpd INTEGER       -- Requests per day

-- Metadata
environment TEXT             -- e.g., "production", "staging"
application TEXT             -- Application using this key
tags JSONB                   -- Array of tags
notes TEXT                   -- Free-form notes
```

### api_key_rate_limits Table (New)

```sql
CREATE TABLE api_key_rate_limits (
    id UUID PRIMARY KEY,
    api_key_id UUID REFERENCES api_keys(id),
    window_start TIMESTAMPTZ,
    window_type TEXT,           -- 'minute', 'hour', 'day'
    request_count INTEGER,
    UNIQUE(api_key_id, window_start, window_type)
);
```

---

## 8. Best Practices

### Security

1. **Never commit API keys** to version control
2. **Use environment variables** for keys in production
3. **Rotate keys regularly** (every 90 days recommended)
4. **Different keys for different environments** (prod/staging/dev)

### Performance

1. **Cache rate limit status** instead of checking every request
2. **Monitor analytics daily** to detect anomalies
3. **Set appropriate limits** based on actual usage patterns
4. **Use tags** to organize keys by priority/type

### Cost Management

1. **Compare keys regularly** to identify expensive ones
2. **Set RPD limits** to prevent runaway costs
3. **Monitor timeline** for unexpected spikes
4. **Track per-key costs** in your billing system

---

## 9. Migration Guide

### Step 1: Run SQL Migration

Execute `migration_007_per_key_limits.sql` in your Supabase SQL editor.

### Step 2: Update Existing Keys (Optional)

```bash
# Add rate limits to existing keys
curl -X PATCH http://localhost:8000/v1/keys/{key_id} \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"rate_limit_rpm":100,"environment":"production"}'
```

### Step 3: Test Rate Limiting

Use `test_api_key_features.py` to verify everything works:

```bash
python test_api_key_features.py
```

---

## 10. Troubleshooting

### Rate Limit Errors

**Problem:** Getting 429 errors unexpectedly

**Solution:**
1. Check current status: `GET /v1/keys/{key_id}/rate-limits`
2. Verify key limits: `GET /v1/keys`
3. Increase limits if needed: `PATCH /v1/keys/{key_id}`

### Missing Usage Data

**Problem:** Analytics showing 0 requests

**Solution:**
1. Ensure `api_key_id` is being logged in `api_usage` table
2. Check that you're using the correct key ID
3. Verify requests are completing successfully (200 status)

### Performance Issues

**Problem:** Rate limit checks slowing down requests

**Solution:**
1. Database indexes are created automatically by migration
2. Old rate limit windows are cleaned up automatically
3. Consider caching rate limit status in your application

---

## Support

For issues or questions:
- GitHub: https://github.com/anthropics/restruct/issues
- Documentation: See README.md

---

**Version:** 1.0
**Last Updated:** 2025-01-15
