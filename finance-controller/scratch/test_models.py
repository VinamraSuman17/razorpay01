import os
import sys
import time
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from src.config_loader import get_settings
from google import genai

def test_model_calls():
    settings = get_settings()
    api_key = getattr(settings.gemini, "api_key", None) or os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)

    candidates = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
    ]

    print("\n=== Testing Real generate_content Calls for Candidate Models ===", flush=True)
    results = {}

    for model_name in candidates:
        print(f"\nTesting model: '{model_name}'...", flush=True)
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents="Hi, reply with 'OK' if working.",
            )
            text = resp.text.strip() if resp.text else "(empty)"
            print(f"SUCCESS [{model_name}]: {text}", flush=True)
            results[model_name] = {"status": "SUCCESS", "response": text}
        except Exception as e:
            err_msg = str(e)
            err_type = type(e).__name__
            print(f"FAILED [{model_name}]: {err_type} - {err_msg}", flush=True)
            results[model_name] = {"status": "FAILED", "error": f"{err_type}: {err_msg}"}
        time.sleep(0.5)

    print("\n\n================ Summary of Model Tests ================", flush=True)
    for model_name, info in results.items():
        if info["status"] == "SUCCESS":
            print(f"✅ {model_name:<30} -> Callable & Active", flush=True)
        else:
            print(f"❌ {model_name:<30} -> {info['error']}", flush=True)

if __name__ == "__main__":
    test_model_calls()
