import os
from pathlib import Path
from typing import Optional
import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Load env variables from .env if present in project or workspace root
base_proj_dir = Path(__file__).resolve().parent.parent
load_dotenv(base_proj_dir / ".env", override=True)
load_dotenv(base_proj_dir.parent / ".env", override=True)

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
