"""
MutualSol - Configuración global de la aplicación
Lee variables del archivo .env
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "MutualSol"
    app_version: str = "0.1.0"
    debug: bool = False
    secret_key: str

    # Base de datos
    database_url: str

    # JWT
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # Tasa BCV
    bcv_scrape_url: str = "https://www.bcv.org.ve"
    dolar_api_url: str = "https://ve.dolarapi.com/v1/dolares"
    tasa_actualizacion_minutos: int = 60

    # Binance (opcional)
    binance_api_key: Optional[str] = None
    binance_secret_key: Optional[str] = None

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:8081"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
