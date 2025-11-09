# Restruct - Quick Start Guide

Get up and running with Restruct in 5 minutes!

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- At least one LLM API key (OpenAI, Google, or Anthropic)

## Step-by-Step Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- FastAPI (web framework)
- Uvicorn (ASGI server)
- OpenAI, Google, Anthropic SDKs
- Optional: Supabase client

### 2. Configure API Keys

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your API key(s):

```env
# Add at least ONE of these:
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_API_KEY=AIyour-google-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Optional (for database features):
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
```

**Where to get API keys:**
- OpenAI: https://platform.openai.com/api-keys
- Google: https://makersuite.google.com/app/apikey
- Anthropic: https://console.anthropic.com/

### 3. Start the Backend

**Option A: Using the start script**
```bash
python start.py
```

**Option B: Direct uvicorn command**
```bash
uvicorn app:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 4. Open the Chat Interface

Navigate to: **http://localhost:8000/index.html**

You should see the Restruct chatbot interface!

## Testing the System

### Test 1: Send a Chat Message

1. Open `http://localhost:8000/index.html`
2. Type: "Explain quantum computing in simple terms"
3. Select routing priority (Balanced recommended)
4. Click Send

You should get a response showing:
- The model's answer
- Which model was selected
- The routing score

### Test 2: Try Different Routing Strategies

**Cost-Optimized:**
- Sends simple prompts to cheaper models
- Best for high-volume, simple tasks

**Performance:**
- Uses high-quality models for better results
- Best for complex reasoning tasks

**Balanced (Default):**
- Optimizes cost/performance ratio
- Best for general use

### Test 3: API Endpoint

Test the API directly:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the capital of France?",
    "priority": "balanced"
  }'
```

Expected response:
```json
{
  "output": "The capital of France is Paris...",
  "model": "gemini-1.5-flash",
  "provider": "google",
  "routing_metadata": {...},
  "usage": {...}
}
```

## How It Works

1. **You send a prompt** → Frontend captures your message
2. **Router analyzes** → Examines prompt characteristics (length, complexity, etc.)
3. **Model selected** → Calculates scores for all models based on cost/performance
4. **API called** → Sends request to the chosen provider (OpenAI/Google/Anthropic)
5. **Response returned** → Displays answer with metadata

## Routing Decision Example

For prompt: "Write a complex analysis of climate change"

```
Prompt Analysis:
- Word count: 7
- Complexity: Analytical
- Code-related: No

Model Scores:
1. gpt-4-turbo (OpenAI) - Score: 95.0
   → High performance needed for analysis
2. claude-3-sonnet (Anthropic) - Score: 88.0
   → Good balance for analytical tasks
3. gemini-1.5-flash (Google) - Score: 75.0
   → Too simple for complex analysis

Selected: gpt-4-turbo
```

## Common Issues

### "No models available" Error

**Cause:** No valid API keys configured

**Solution:**
1. Check `.env` file exists
2. Verify at least one API key is set
3. Make sure key format is correct (starts with `sk-` for OpenAI/Anthropic)

### CORS Error in Browser

**Cause:** Frontend can't reach backend

**Solution:**
- Ensure backend is running on `localhost:8000`
- Check browser console for specific errors
- Try `http://127.0.0.1:8000/index.html` instead

### Module Import Errors

**Cause:** Missing dependencies

**Solution:**
```bash
pip install -r requirements.txt
```

### API Key Invalid

**Cause:** Wrong key or insufficient credits

**Solution:**
- Verify key is correct
- Check account has credits/quota
- Try a different provider

## Next Steps

### Customize Model Selection

Edit `models_config.py` to adjust:
- Cost values (per 1K tokens)
- Performance scores (0-1 scale)
- Model attributes

### Add More Models

Add new models to `models_config.py`:

```python
"openai": {
    "models": {
        "gpt-4o-mini": {
            "cost": 0.0001,
            "performance": 0.8,
            "max_tokens": 128000,
            "description": "Ultra-fast GPT-4"
        }
    }
}
```

### Adjust Routing Logic

Modify `router.py` to change how models are scored:

```python
def calculate_score(self, model_name, model_attrs, prompt_analysis, priority):
    # Your custom logic here
    score = performance / cost

    # Add custom bonuses
    if "financial" in prompt.lower():
        score *= 1.5  # Prefer certain models for finance

    return score
```

### Enable Database Logging

1. Create Supabase account (free tier available)
2. Create tables using schema in README.md
3. Add credentials to `.env`
4. Database logging is automatic!

## API Documentation

Once running, view interactive API docs:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

Try endpoints directly from the browser!

## Development Mode

### Hot Reload

The `--reload` flag auto-restarts the server when code changes:

```bash
uvicorn app:app --reload
```

### Debug Mode

Add print statements in any module:

```python
# In router.py
print(f"Selected model: {best_model}, Score: {best_score}")
```

Output appears in the terminal running uvicorn.

### Test Router Only

Get routing decision without calling APIs:

```bash
curl -X POST http://localhost:8000/routing/route \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test prompt", "priority": "cost"}'
```

## Production Deployment

For production use:

1. **Remove `--reload` flag**
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000
   ```

2. **Use environment variables** (not .env file)

3. **Enable HTTPS** with reverse proxy (nginx/caddy)

4. **Set specific CORS origins** in `app.py`:
   ```python
   allow_origins=["https://yourdomain.com"]
   ```

5. **Add rate limiting** and authentication

6. **Use production database** (Supabase/PostgreSQL)

## Support

- Check [README.md](README.md) for detailed documentation
- View code comments for implementation details
- Open issues on GitHub for bugs/features

## Tips & Tricks

1. **Test with various prompts** to see routing in action
2. **Monitor costs** by checking routing decisions
3. **Adjust priorities** based on your use case
4. **Use cost mode** for high-volume simple tasks
5. **Use performance mode** for critical outputs

Enjoy using Restruct! 🎯
