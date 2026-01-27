# Restruct

**Live App:** [https://restruct-two.vercel.app](https://restruct-two.vercel.app)

Restruct is an intelligent, multi-model chat interface designed to optimize your interaction with Large Language Models (LLMs). It acts as a smart router, dynamically selecting the best model (OpenAI, Google Gemini, Anthropic Claude) for your specific query to balance cost, performance, and speed.

## Key Features

### 🔑 Generate API Keys
Restruct allows you to generate and manage custom API keys for secure access.
1. Navigate to the **Settings** or **API Keys** section in the sidebar.
2. Click **Generate New Key**.
3. Set rate limits and expiration if needed.
4. Use this key to authenticate requests against the Restruct API programmatically.

### 🛠️ Custom Routing Profiles
Tailor the routing logic to your needs. You can create profiles that prioritize:
- **Cost**: Route to the cheapest model that can handle the task.
- **Performance**: Route to the most capable model (e.g., GPT-5, Claude Opus) regardless of cost.
- **Speed**: Prioritize low-latency models for quick responses.

**To create a profile:**
1. Go to the **Routing Profiles** tab.
2. Define your criteria (e.g., "Max cost per query: $0.01").
3. Save the profile and select it from the chat interface.

### 🎛️ Model Override
Want to force a specific model? You can bypass the router manually.
- In the chat interface, use the **Model Dropdown** to select a specific provider and model (e.g., `openai:gpt-5`, `google:gemini-1.5-pro`).
- This disables automatic routing for the current session.

### ⚡ Use Multiple Models at Once
Compare results or get diverse perspectives by querying multiple models simultaneously.
- Enable **Multi-Model Mode** in the chat settings.
- Select the models you want to query (e.g., GPT-5 vs. Claude 3.5 Sonnet).
- Your prompt will be sent to all selected models in parallel, and results will be displayed side-by-side.

## Getting Started
1. **Sign Up/Login**: Create an account to sync your conversations and preferences.
2. **Configure API Keys**: Ensure you have valid API keys for the underlying providers (OpenAI, Google, Anthropic) if running your own instance, or use the provided community keys.
3. **Start Chatting**: Type your prompt and let Restruct handle the rest!
