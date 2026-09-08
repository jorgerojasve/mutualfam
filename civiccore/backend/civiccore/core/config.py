"""
CivicCore - Base Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional

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

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow" # Allow extension by specific implementations

settings = CivicCoreSettings()
