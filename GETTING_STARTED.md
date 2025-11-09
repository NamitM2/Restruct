# Getting Started with Restruct

Welcome to **Restruct** - your intelligent LLM router! This guide will get you up and running in minutes.

## What is Restruct?

Restruct automatically selects the best AI model from OpenAI, Google, and Anthropic based on:
- **Cost** - Minimize API expenses
- **Performance** - Maximize response quality
- **Context** - Match model capabilities to your prompt

## Quick Start (5 Minutes)

### Step 1: Verify Installation

Run the test script to make sure everything is set up:

```bash
python test_system.py
```

You should see:
```
✅ All tests passed! System is ready.
```

### Step 2: Get API Keys

You need at least ONE API key from:

**OpenAI** (Recommended for first-time setup)
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-`)

**Google Gemini** (Free tier available)
1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API key"
3. Copy the key (starts with `AI`)

**Anthropic Claude** (Optional)
1. Go to https://console.anthropic.com/
2. Create API key
3. Copy the key (starts with `sk-ant-`)

### Step 3: Configure API Keys

Create your `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and paste your key(s):

```env
# At minimum, add ONE of these:
OPENAI_API_KEY=sk-your-actual-key-here
GOOGLE_API_KEY=AIyour-actual-key-here
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

**💡 Tip**: Start with just OpenAI if you're testing. Add more providers later.

### Step 4: Install Python Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- FastAPI (web framework)
- Uvicorn (server)
- OpenAI, Google, Anthropic SDKs
- Optional: Supabase (database)

### Step 5: Start the Server

```bash
python start.py
```

You should see:
```
Starting Restruct backend...

📍 API: http://localhost:8000
📍 Docs: http://localhost:8000/docs
📍 Frontend: http://localhost:8000/index.html

Press Ctrl+C to stop the server
```

### Step 6: Open the Chat Interface

Navigate to: **http://localhost:8000/index.html**

🎉 You should see the Restruct chatbot!

## Your First Chat

1. **Type a message**: "Explain quantum computing in simple terms"

2. **Select routing priority**:
   - **Balanced** (default) - Best value
   - **Cost** - Cheapest option
   - **Performance** - Highest quality

3. **Click Send**

4. **View the response** with:
   - Model's answer
   - Which model was selected
   - Routing score

## Understanding Routing Priorities

### 🎯 Balanced (Recommended)
- **Best for**: General use
- **Logic**: Optimizes cost/performance ratio
- **Example**: Uses GPT-4o or Gemini Pro for complex tasks, cheaper models for simple queries

### 💰 Cost-Optimized
- **Best for**: High-volume, simple tasks
- **Logic**: Prefers cheapest models
- **Example**: Uses GPT-3.5-turbo or Gemini Flash whenever possible

### ⚡ Performance
- **Best for**: Critical outputs, complex analysis
- **Logic**: Prefers highest-quality models
- **Example**: Uses GPT-4-turbo or Claude Opus for best results

## How Routing Works

Restruct analyzes your prompt and scores each model:

```
Your Prompt: "Write a complex analysis of climate data"

Analysis:
├─ Length: Long (200+ words)
├─ Type: Analytical
├─ Complexity: High
└─ Code: No

Model Scores (Balanced mode):
1. gpt-4-turbo     Score: 95.0 ⭐ SELECTED
2. claude-3-opus   Score: 91.2
3. gemini-1.5-pro  Score: 88.5
4. gpt-3.5-turbo   Score: 46.7
```

## Common Use Cases

### 1. General Queries (Balanced)
```javascript
"What is the capital of France?"
→ Routes to: gemini-1.5-flash (fast & cheap)
```

### 2. Code Help (Balanced)
```javascript
"Explain React hooks with examples"
→ Routes to: gpt-4-turbo (code-optimized)
```

### 3. Batch Processing (Cost)
```javascript
// Process 1000 simple questions
for each question:
  priority: "cost"
→ Routes to: gpt-3.5-turbo or gemini-flash
→ Saves: ~80% on API costs
```

### 4. Important Analysis (Performance)
```javascript
"Analyze this financial report in detail..."
priority: "performance"
→ Routes to: claude-3-opus or gpt-4-turbo
→ Result: Highest quality output
```

## Testing the API Directly

### Simple Chat
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello, world!",
    "priority": "balanced"
  }'
```

### Check Routing Decision
```bash
curl -X POST http://localhost:8000/routing/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain neural networks",
    "priority": "cost"
  }'
```

### List Available Models
```bash
curl http://localhost:8000/models
```

## Exploring the API

FastAPI provides interactive documentation:

**Swagger UI**: http://localhost:8000/docs
- Try endpoints directly in browser
- See request/response schemas
- Test with different parameters

**ReDoc**: http://localhost:8000/redoc
- Clean, readable documentation
- Download API spec

## Customizing Restruct

### Add a New Model

Edit `models_config.py`:

```python
"openai": {
    "models": {
        "gpt-4o-mini": {  # New model
            "cost": 0.0001,
            "performance": 0.8,
            "max_tokens": 128000,
            "description": "Ultra-fast GPT-4"
        }
    }
}
```

Restart the server - new model is automatically available!

### Adjust Routing Weights

Edit `router.py` - modify scoring in `calculate_score()`:

```python
# Give extra weight to certain prompts
if "financial" in prompt.lower():
    score *= 1.5  # Prefer high-quality models for finance

if word_count < 20:
    score *= 1.2  # Boost cheap models for short prompts
```

### Change Cost/Performance Scores

Edit `models_config.py`:

```python
"gpt-4-turbo": {
    "cost": 0.01,      # Adjust based on actual usage
    "performance": 0.98  # Fine-tune based on results
}
```

## Troubleshooting

### ❌ "No models available"

**Problem**: No API keys configured

**Solution**:
```bash
# Check .env file exists
ls .env

# Verify at least one key is set
cat .env | grep API_KEY

# Make sure keys don't contain "your-" prefix
```

### ❌ CORS Error in Browser

**Problem**: Frontend can't reach backend

**Solution**:
- Verify server is running: `http://localhost:8000`
- Try `http://127.0.0.1:8000/index.html`
- Check browser console for details
- Ensure no other service is using port 8000

### ❌ "Module not found" Error

**Problem**: Missing dependencies

**Solution**:
```bash
pip install -r requirements.txt
```

### ❌ Invalid API Key

**Problem**: API returns 401 Unauthorized

**Solution**:
- Verify key is correct (check for extra spaces)
- Ensure account has credits
- Check key permissions/scope
- Try a different provider temporarily

### ⚠️ Database Warnings (Safe to Ignore)

```
Warning: Supabase credentials not configured
```

This is **normal** - database is optional. App works fine without it!

To enable database features, see [README.md](README.md#database-optional)

## Next Steps

### 1. Run the Router UI (Separate Testing Interface)

The `router-ui` folder contains a dedicated test console:

```bash
cd router-ui
npm install
npm run dev
```

Open http://localhost:5173

### 2. Enable Database Logging

Set up Supabase to track all conversations:

1. Create free account at https://supabase.com
2. Create new project
3. Get credentials from Settings
4. Add to `.env`:
   ```env
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_KEY=eyJ...
   ```

5. Create tables (see README.md for schema)

### 3. Integrate into Your App

Use Restruct as an API backend:

```javascript
// Your app
const response = await fetch('http://localhost:8000/chat', {
  method: 'POST',
  body: JSON.stringify({
    prompt: userInput,
    priority: 'balanced',
    user_id: 'user123'
  })
});

const data = await response.json();
console.log(data.output);  // Model's response
console.log(data.model);   // Which model was used
```

### 4. Deploy to Production

See [README.md](README.md#production-deployment) for:
- Removing --reload flag
- Setting up HTTPS
- Configuring CORS properly
- Adding authentication
- Rate limiting

## Learning Resources

### Understanding the Code

- **app.py** - Main server (start here)
- **router.py** - Routing logic
- **inference.py** - API clients
- **models_config.py** - Model settings

### Example Workflows

**Simple chatbot**:
```
User → Frontend → /chat → Router → Inference → Response
```

**Routing preview**:
```
User → Frontend → /routing/route → Router → Decision (no API call)
```

**With database**:
```
User → /chat → Router → Inference → Database → Response
                                      ↓
                               Logs everything
```

## Getting Help

1. **Check the docs**:
   - [README.md](README.md) - Full documentation
   - [QUICKSTART.md](QUICKSTART.md) - Detailed setup
   - [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Architecture

2. **Review examples** in the code comments

3. **Test with**:
   ```bash
   python test_system.py  # Verify setup
   ```

4. **Check API docs**: http://localhost:8000/docs

## Tips for Success

1. **Start simple**: Test with one provider first
2. **Monitor costs**: Check routing decisions in responses
3. **Experiment**: Try different priorities for same prompt
4. **Adjust scores**: Fine-tune cost/performance values
5. **Read logs**: Terminal shows routing decisions

## Congratulations! 🎉

You're now running Restruct!

Try different prompts and watch how it intelligently selects the best model for each task.

Happy routing! 🚀
