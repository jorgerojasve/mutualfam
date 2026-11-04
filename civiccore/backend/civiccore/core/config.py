"""
CivicCore - Base Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


def is_qa_environment() -> bool:
    """
    Detecta si el backend está ejecutándose en el entorno de QA/Sandbox.
    En QA se aceleran los períodos de debate y votación a 1 día cada uno para pruebas.
    En producción se mantienen los períodos reglamentarios completos.
    """
    civic_env = os.getenv("CIVICCORE_ENV", "").lower()
    if civic_env in ("sandbox", "qa", "test"):
        return True
    fly_app = os.getenv("FLY_APP_NAME", "").lower()
    if "qa" in fly_app:
        return True
    backend_url = os.getenv("BACKEND_PUBLIC_URL", "").lower()
    if "qa" in backend_url:
        return True
    return False


class CivicCoreSettings(BaseSettings):
    # App Information
    app_name: str = "CivicCore Application"
    app_version: str = "0.1.0"
    debug: bool = False
    secret_key: str = "changeme"

    # Database
    database_url: str = "sqlite:///./civiccore.db"

    # JWT Authentication
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # CORS Settings
    cors_origins: str = "*"

    # App Manifest
    manifest: dict = {}

    # Telegram Integration
    telegram_bot_token: Optional[str] = None
    telegram_storage_chat_id: Optional[str] = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow" # Allow extension by specific implementations

settings = CivicCoreSettings()
