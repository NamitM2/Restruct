import subprocess
import time
import sys
import os
import signal
import webbrowser
from threading import Thread

def run_backend():
    print("Starting Backend (Uvicorn)...")
    # Using sys.executable to ensure we use the same python interpreter
    # backend_code.app:app requires running from the root/parent of backend_code
    subprocess.run([sys.executable, "-m", "uvicorn", "backend_code.app:app", "--reload", "--port", "8000"])

def run_frontend():
    print("Starting Frontend (http.server)...")
    # Change into frontend directory to serve it
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    
    # Check if port 5500 is in use (optional simple check or just let it fail/retry)
    # We'll just run it.
    subprocess.run([sys.executable, "-m", "http.server", "5500", "--directory", frontend_dir])

if __name__ == "__main__":
    # Create threads
    backend_thread = Thread(target=run_backend)
    frontend_thread = Thread(target=run_frontend)
    
    # Daemon threads will exit when the main program exits
    backend_thread.daemon = True
    frontend_thread.daemon = True
    
    try:
        backend_thread.start()
        frontend_thread.start()
        
        print("\n===================================================")
        print("Restruct Local Dev Environment Started")
        print("Backend: http://localhost:8000")
        print("Frontend: http://localhost:5500")
        print("===================================================\n")
        
        # Give it a moment to initialize then open browser
        time.sleep(2)
        webbrowser.open("http://localhost:5500")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nStopping services...")
        # Threads are daemon, so they will be killed when we exit
        sys.exit(0)
