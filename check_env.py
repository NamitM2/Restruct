"""
Environment check for Restruct
Verifies PyTorch installation and CUDA availability
"""
import sys

def check_environment():
    """Check Python version, PyTorch, and CUDA availability."""
    print("=== Restruct Environment Check ===\n")

    # Python version
    print(f"Python version: {sys.version}")
    print(f"Python executable: {sys.executable}\n")

    # PyTorch
    import torch
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")

    if torch.cuda.is_available():
        print(f"CUDA version: {torch.version.cuda}")
        print(f"CUDA device count: {torch.cuda.device_count()}")
        print(f"CUDA device name: {torch.cuda.get_device_name(0)}")
    else:
        print("CUDA not available - will use CPU")

    print("\n✓ Environment check complete")

if __name__ == "__main__":
    check_environment()
