#!/usr/bin/env python3
"""
Quick start script for Restruct
Runs the FastAPI backend server
"""

import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("  Restruct - Smart Model Router")
    print("=" * 60)
    print()

    # Check if .env file exists
    if not os.path.exists(".env"):
        print("⚠️  Warning: .env file not found!")
        print("   Copy .env.example to .env and add your API keys")
        print()
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Setup cancelled. Please configure .env first.")
            sys.exit(0)

    print("Starting Restruct backend...")
    print()
    print("📍 API: http://localhost:8000")
    print("📍 Docs: http://localhost:8000/docs")
    print("📍 Frontend: http://localhost:8000/index.html")
    print()
    print("Press Ctrl+C to stop the server")
    print("-" * 60)
    print()

    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn",
            "app:app",
            "--reload",
            "--host", "0.0.0.0",
            "--port", "8000"
        ], check=True)
    except KeyboardInterrupt:
        print("\n\nShutting down Restruct...")
        sys.exit(0)
    except Exception as e:
        print(f"\nError: {e}")
        print("\nMake sure you've installed requirements:")
        print("  pip install -r requirements.txt")
        sys.exit(1)

if __name__ == "__main__":
    main()
