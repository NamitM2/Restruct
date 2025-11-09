#!/usr/bin/env python3
"""
Development server launcher for Restruct Router Test Console
Runs the Vite dev server for the chat interface
"""

import subprocess
import sys
import os
import platform

def main():
    # Change to the script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    print("Starting Restruct Router Test Console...")
    print("Directory:", script_dir)
    print("Server will be available at: http://localhost:5173")
    print("Make sure your FastAPI backend is running at: http://localhost:8000")
    print("-" * 60)

    try:
        # Run npm run dev with shell=True on Windows
        is_windows = platform.system() == "Windows"
        subprocess.run(["npm", "run", "dev"], check=True, shell=is_windows)
    except KeyboardInterrupt:
        print("\n\nShutting down dev server...")
        sys.exit(0)
    except subprocess.CalledProcessError as e:
        print(f"\nError running dev server: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print("\nnpm not found. Please install Node.js and npm first.")
        print("Download from: https://nodejs.org/")
        sys.exit(1)

if __name__ == "__main__":
    main()
