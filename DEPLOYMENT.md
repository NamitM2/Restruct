# Deployment Guide

This guide details how to deploy Restruct to **Render** (Backend) and **Vercel** (Frontend).

## Prerequisites

1.  **GitHub Repository**: Ensure your project is pushed to a GitHub repository.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **Vercel Account**: Sign up at [vercel.com](https://vercel.com).
4.  **Supabase Project**: Ensure your Supabase database is active and you have the URL and Key.

---

## Part 1: Deploy Backend to Render

1.  **Create a Web Service**:
    *   Go to the Render Dashboard and click **New +** -> **Web Service**.
    *   Connect your GitHub repository.

2.  **Configure Service**:
    *   **Name**: `restruct-backend` (or similar).
    *   **Region**: Choose one close to you (e.g., Oregon, Frankfurt).
    *   **Branch**: `main`.
    *   **Root Directory**: `.` (leave empty).
    *   **Runtime**: `Python 3`.
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `uvicorn backend_code.app:app --host 0.0.0.0 --port $PORT`

3.  **Environment Variables**:
    *   Scroll down to **Environment Variables**.
    *   Add all keys from your `.env` file **EXCEPT** `PORT` (Render sets this automatically) and `DEMO_MODE` (set this to `true` if you want the demo limits enforced).
    *   **Required Variables**:
        *   `SUPABASE_URL`
        *   `SUPABASE_KEY`
        *   `OPENAI_API_KEY`
        *   `ANTHROPIC_API_KEY`
        *   `GOOGLE_API_KEY`
        *   `BING_SEARCH_V7_SUBSCRIPTION_KEY`
        *   `BING_SEARCH_V7_ENDPOINT`
        *   `DEMO_MODE`: `true`

4.  **Deploy**:
    *   Click **Create Web Service**.
    *   Wait for the deployment to finish. It will give you a URL like `https://restruct-backend.onrender.com`.
    *   **Copy this URL**.

---

## Part 2: Update Frontend Configuration

1.  Open `frontend/config.js` in your local project.
2.  Replace the placeholder URL with your actual Render backend URL:
    ```javascript
    // Before
    const API_BASE = IS_DEV ? 'http://localhost:8000' : 'https://your-backend-app.onrender.com';

    // After
    const API_BASE = IS_DEV ? 'http://localhost:8000' : 'https://restruct-backend.onrender.com';
    ```
    *(Make sure to remove any trailing slashes)*
3.  Commit and push this change to GitHub:
    ```bash
    git add frontend/config.js
    git commit -m "Update backend URL for production"
    git push origin main
    ```

---

## Part 3: Deploy Frontend to Vercel

1.  **Create New Project**:
    *   Go to the Vercel Dashboard and click **Add New...** -> **Project**.
    *   Import your GitHub repository.

2.  **Configure Project**:
    *   **Framework Preset**: Other / None.
    *   **Root Directory**: Click `Edit` and select `frontend`.
    *   **Build Command**: Leave empty (it's a static site).
    *   **Output Directory**: Leave empty.

3.  **Deploy**:
    *   Click **Deploy**.
    *   Vercel will build and assign a domain (e.g., `restruct.vercel.app`).

4.  **Final Test**:
    *   Visit your Vercel URL.
    *   Try to sign in (in Demo mode, any email/password usually works if you haven't set up strict auth logic, or use your Supabase credentials).
    *   Check the "Wallet" tab to see if it connects to the backend (it should say "In Development" / "Allocated: 20 req/day").

---

## Troubleshooting

*   **CORS Errors**: If you see CORS errors in the browser console, you might need to update the `allow_origins` list in `backend_code/app.py`.
    *   Add your Vercel domain to the list:
        ```python
        allow_origins=[
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "https://your-project.vercel.app" 
        ]
        ```
    *   Then redeploy the backend.
