# Restruct - Smart Model Router

An intelligent LLM router that automatically selects the optimal model from multiple providers (OpenAI, Google, Anthropic) based on cost, performance, and prompt characteristics.

## Features

- 🎯 **Smart Routing**: Automatically routes prompts to the best model
- 💰 **Cost Optimization**: Choose between cost, performance, or balanced routing
- ⚡ **Multi-Provider**: Supports OpenAI, Google Gemini, and Anthropic Claude
- 🎨 **Modern UI**: Clean chatbot interface with real-time responses
- 📊 **Metadata Tracking**: View routing decisions and model scores
- 🔌 **Modular Architecture**: Easily extend with new providers or features

## Architecture

```
┌─────────────┐
│  Frontend   │  (HTML/CSS/JS)
└──────┬──────┘
       │
┌──────▼──────┐
│  FastAPI    │  (app.py)
└──────┬──────┘
       │
   ┌───┴────┬─────────┬──────────┐
   │        │         │          │
┌──▼──┐  ┌─▼──┐   ┌──▼────┐  ┌──▼──────┐
│Router│  │Inf.│   │Database│  │Config  │
└──────┘  └────┘   └────────┘  └─────────┘
```

## File Structure

```
Restruct/
├── app.py              # FastAPI backend
├── router.py           # Model selection logic
├── inference.py        # API call handling
├── database.py         # Supabase integration
├── models_config.py    # Model metadata
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variables template
├── README.md           # This file
└── frontend/
    ├── index.html      # Chat interface
    ├── style.css       # Styling
    └── script.js       # Frontend logic
```

## Setup & Installation

### 1. Install Dependencies

```bash
# Install Python packages
pip install -r requirements.txt
```

### 2. Configure API Keys

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add at least one API key:

```env
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AI...
ANTHROPIC_API_KEY=REDACTED...
```

### 3. Run the Backend

```bash
# Start the FastAPI server
uvicorn app:app --reload

# Server will be available at:
# - API: http://localhost:8000
# - Docs: http://localhost:8000/docs
# - Frontend: http://localhost:8000/index.html
```

### 4. Open the Frontend

Navigate to `http://localhost:8000/index.html` in your browser.

## Usage

### Web Interface

1. Open the chatbot at `http://localhost:8000/index.html`
2. Select routing priority:
   - **Balanced**: Optimize for cost/performance ratio
   - **Cost-Optimized**: Prefer cheaper models
   - **Performance**: Prefer higher-quality models
3. Type your message and press Enter or click Send
4. View the response with model metadata

### API Endpoints

#### POST /chat

Main chat endpoint that routes and runs inference:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing",
    "priority": "balanced",
    "max_tokens": 1000,
    "temperature": 0.7
  }'
```

Response:
```json
{
  "output": "Quantum computing is...",
  "model": "gpt-4o",
  "provider": "openai",
  "routing_metadata": {
    "score": 8.5,
    "prompt_analysis": {...},
    "alternatives": [...]
  },
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 150,
    "total_tokens": 162
  }
}
```

#### POST /routing/route

Get routing decision without running inference:

```bash
curl -X POST http://localhost:8000/routing/route \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a poem",
    "priority": "cost"
  }'
```

#### GET /models

List all available models:

```bash
curl http://localhost:8000/models
```

## Routing Logic

The router analyzes prompts and calculates scores for each model based on:

1. **Cost**: Lower cost = higher score (for cost priority)
2. **Performance**: Model quality score (0-1)
3. **Prompt Analysis**:
   - Long prompts → prefer long-context models
   - Code-related → prefer coding-optimized models
   - Analytical tasks → prefer high-performance models
   - Simple tasks → prefer fast/cheap models

**Score Formula** (balanced mode):
```python
score = performance / cost
```

With bonuses applied for matching prompt characteristics.

## Model Configuration

Edit `models_config.py` to:

- Add new models
- Update cost/performance scores
- Configure model attributes

Example:
```python
MODELS = {
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "models": {
            "gpt-4-turbo": {
                "cost": 0.01,
                "performance": 0.95,
                "max_tokens": 128000,
                "description": "High performance"
            }
        }
    }
}
```

## Database (Optional)

To enable conversation logging with Supabase:

1. Create a Supabase project
2. Add credentials to `.env`
3. Create tables (see database schema below)

### Database Schema

```sql
-- Interactions table
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    output TEXT NOT NULL,
    routing_metadata JSONB,
    usage JSONB,
    user_id TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- API Keys table (optional)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    api_key TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, provider)
);
```

## Development

### Running Tests

```bash
# Run the router UI separately
cd router-ui
npm run dev
```

### Adding New Providers

1. Add provider config to `models_config.py`
2. Implement API client in `inference.py`
3. Update routing logic if needed in `router.py`

### API Documentation

FastAPI auto-generates interactive docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Future Enhancements

Planned features for future versions:

- [ ] Citations and source tracking
- [ ] Automatic summarization
- [ ] Token reduction strategies
- [ ] PII redaction
- [ ] Response caching
- [ ] Multi-turn conversations
- [ ] User authentication
- [ ] Advanced analytics dashboard
- [ ] Streaming responses
- [ ] Rate limiting

## Troubleshooting

### "No models available" error

- Make sure you've added at least one API key to `.env`
- Verify API keys are valid
- Check that the provider SDK is installed

### CORS errors in browser

- Backend must be running on `localhost:8000`
- Check browser console for specific errors
- Ensure CORS middleware is enabled in `app.py`

### Database errors (non-critical)

- Database features are optional
- The app will continue working without Supabase
- Check Supabase credentials if you want logging

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues or questions:

- Open a GitHub issue
- Check the API documentation at `/docs`
- Review the code comments for implementation details
