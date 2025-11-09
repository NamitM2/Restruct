# Restruct Router Test Console

A minimal ChatGPT-style interface for testing FastAPI LLM router endpoints locally.

## Prerequisites

- Node.js 18+ and npm
- FastAPI backend running at `http://localhost:8000`

## Setup & Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. Make sure your FastAPI backend is running at `http://localhost:8000`
2. Open the app in your browser
3. Type a message and press Enter or click Send
4. The router response will appear with the model name displayed

## Expected Backend API

**Endpoint:** `POST http://localhost:8000/routing/route`

**Request:**
```json
{
  "prompt": "user input here"
}
```

**Response:**
```json
{
  "model": "gpt-4-turbo",
  "output": "The model's reply text",
  "metadata": {}
}
```

## Features

- ChatGPT-style centered chat interface
- User messages (right-aligned, gray)
- Router responses (left-aligned, darker with model name)
- Loading state ("Thinking...")
- Auto-scroll to latest message
- Error handling with helpful messages
- Responsive design with TailwindCSS
- Conversation history persists during session

## Tech Stack

- React 18
- Vite
- TailwindCSS
- Native Fetch API

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.
