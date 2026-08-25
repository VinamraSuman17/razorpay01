import os
from pathlib import Path
from typing import Optional
import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

def mask_api_key(key: Optional[str]) -> str:
    if not key or not key.strip():
        return "<NOT SET>"
    k = key.strip()
    if len(k) < 10:
        return f"{k[:2]}...{k[-2:]}"
    return f"{k[:6]}...{k[-4:]}"

def get_client_masked_key(client=None, settings=None) -> str:
    key = None
    if client and hasattr(client, "_api_client") and hasattr(client._api_client, "api_key"):
        key = getattr(client._api_client, "api_key", None)
    if not key:
        reload_environment()
        key = os.getenv("GEMINI_API_KEY")
    if not key and settings and hasattr(settings, "gemini_api_key"):
        key = getattr(settings, "gemini_api_key", None)
    return mask_api_key(key) if key else "[NO_KEY_FOUND]"

def reload_environment() -> list[str]:
    """
    Scans candidate .env file locations (workspace root, project root, backend subfolder)
    and loads them with override=True so updated .env values take precedence over stale OS env vars.
    """
    base_proj_dir = Path(__file__).resolve().parent.parent
    candidate_envs = [
        base_proj_dir.parent / ".env",          # Workspace root (e.g. RazorPay/.env)
        base_proj_dir / ".env",                 # Project root (finance-controller/.env)
        base_proj_dir / "backend" / ".env",     # Backend subfolder (finance-controller/backend/.env)
    ]
    loaded_from = []
    for env_file in candidate_envs:
        if env_file.exists():
            load_dotenv(env_file, override=True)
            loaded_from.append(str(env_file))
    return loaded_from

# Initial reload on module import
_loaded_env_files = reload_environment()

class ReconciliationConfig(BaseModel):
    amount_tolerance_paise: int
    amount_tolerance_percent: float
    date_tolerance_days: int

class ThresholdConfig(BaseModel):
    auto_match_confidence: float
    needs_review_confidence: float

class GeminiConfig(BaseModel):
    model_name: str
    requests_per_minute: int

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    reconciliation: ReconciliationConfig
    thresholds: ThresholdConfig
    gemini: GeminiConfig
    
    # API Key loaded from environment variable
    gemini_api_key: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")

    @classmethod
    def load_from_yaml(cls, yaml_path: str | Path) -> "Settings":
        with open(yaml_path, "r") as f:
            yaml_data = yaml.safe_load(f) or {}
        
        # We construct the model, pydantic-settings will auto-populate GEMINI_API_KEY from environment
        return cls(**yaml_data)

# Global settings instance helper
def get_settings() -> Settings:
    # Resolve the config path relative to project root
    base_dir = Path(__file__).resolve().parent.parent
    yaml_path = base_dir / "config" / "settings.yaml"
    return Settings.load_from_yaml(yaml_path)
