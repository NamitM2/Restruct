"""
Development server launcher for Restruct.
Run this to start the backend + serve frontend.
"""

import threading
import time
import webbrowser

import uvicorn

APP_URL = "http://localhost:8000"


def _launch_browser():
    """Give uvicorn a head start, then open the UI in the default browser."""
    time.sleep(1.5)
    webbrowser.open(APP_URL)


if __name__ == "__main__":
    print("=" * 60)
    print("  Restruct Development Server")
    print("=" * 60)
    print(f"\nAPI: {APP_URL}")
    print(f"Docs: {APP_URL}/docs")
    print(f"Frontend: {APP_URL}")
    print("\nPress Ctrl+C to stop\n")
    print("-" * 60)

    threading.Thread(target=_launch_browser, daemon=True).start()

    uvicorn.run(
        "backend_code.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )