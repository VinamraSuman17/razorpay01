import os
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from src.config_loader import get_settings
from google import genai

def list_all_models():
    settings = get_settings()
    api_key = getattr(settings.gemini, "api_key", None) or os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found in settings or environment!")
        return

    print(f"Using API Key: {api_key[:6]}...{api_key[-4:]}")
    client = genai.Client(api_key=api_key)

    print("\n=== Fetching models via client.models.list() ===")
    models = list(client.models.list())
    
    print(f"\nTotal models returned: {len(models)}\n")
    print(f"{'Model Name/ID':<45} | {'Supported Actions':<35}")
    print("-" * 85)
    
    generate_content_models = []
    
    for m in models:
        # m.name usually looks like 'models/gemini-2.0-flash' or 'gemini-2.0-flash'
        name = getattr(m, 'name', str(m))
        methods = getattr(m, 'supported_generation_methods', []) or []
        print(f"{name:<45} | {', '.join(methods):<35}")
        if 'generateContent' in methods or not methods:
            generate_content_models.append(name)
            
    print("\n=== Candidate Text Generation Models ===")
    for g in generate_content_models:
        clean_name = g.replace("models/", "")
        print(f"- {clean_name}")

if __name__ == "__main__":
    list_all_models()
