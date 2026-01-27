# Restruct: Intelligent Multi-Model LLM Router

Restruct is a high-performance, intelligent model routing system designed to optimize LLM usage by dynamically selecting the most suitable model for a given prompt. It combines a sophisticated backend router with a modern React frontend and a comprehensive wallet/billing system.

## 🚀 Key Features

*   **Smart Routing**: Analyzes prompt complexity (using Gemini 2.0 or local models) to route requests to the most cost-efficient model that can handle the task.
*   **Multi-Provider Support**: Seamlessly integrates with OpenAI, Anthropic, Google Gemini, and local LLMs.
*   **Wallet & Billing**: Built-in system for tracking token usage, costs, and managing user balances with Supabase.
*   **Routing Profiles**: customizable routing logic allowing users to define "Cost Optimized" vs "Performance First" strategies.
*   **Batch Processing**: Parallel execution of prompts across multiple models with SSE streaming.
*   **Community Profiles**: Share and discover optimized routing configurations.

## 🛠️ Technology Stack

*   **Backend**: Python, FastAPI, Uvicorn
*   **Database**: Supabase (PostgreSQL + Auth)
*   **Frontend**: React, Vite/Esbuild (Custom build script), Framer Motion
*   **AI/ML**: `google-genai`, `openai`, `anthropic` SDKs, `llama-cpp-python` (for local routing)

## 📂 Project Structure

*   `backend_code/`: Core application logic
    *   `app.py`: Main FastAPI application entry point.
    *   `router.py`: Logic for scoring prompts and selecting models.
    *   `inference.py`: Unified interface for calling different LLM providers.
    *   `API/`: Routes for wallet, batch processing, and other features.
*   `frontend/`: React-based web interface.
*   `scripts/`: Utility scripts for development and maintenance (e.g., `dev.py`, `check_env.py`).
*   `tests/`: Test suite (API tests, performance benchmarks).
*   `mesh_experiments/`: Experimental visualizations and JavaScript prototypes.
*   `logs/`: Application logs and experiment results.
*   `database/`: Database schemas, migration SQL files, and documentation.

## ⚡ Quick Start

### Prerequisites
*   Python 3.10+
*   Node.js & npm
*   Supabase account & project

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/NamitM2/Restruct.git
    cd Restruct
    ```

2.  **Install Backend Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

4.  **Environment Setup:**
    Create a `.env` file in the root directory (see `.env.example`) and add your API keys:
    ```env
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_key
    OPENAI_API_KEY=sk-...
    ANTHROPIC_API_KEY=sk-...
    GOOGLE_API_KEY=REDACTED...
    ```

### Running the Application

Use the development launcher to start both the backend API and the frontend:

```bash
python scripts/dev.py
```

This will:
*   Start the FastAPI server on `http://localhost:8000`
*   Open the frontend in your default browser

## 🧪 Testing

Run the test suite to verify functionality:

```bash
# Run python tests
pytest tests/

# Run frontend tests
npm test
```

## 📜 License

ISC
