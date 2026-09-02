import os
import sys
import traceback

if __name__ == "__main__":
    # Ensure current directory is in sys.path for backend.main and src imports
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"[STARTUP] Starting Uvicorn server on {host}:{port} (Python {sys.version})...")
    
    try:
        import uvicorn
        uvicorn.run("backend.main:app", host=host, port=port, log_level="info")
    except Exception as e:
        print(f"[STARTUP ERROR] Server failed to start: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
