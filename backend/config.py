from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str = "sqlite:///./data/crab.db"
    data_dir: Path = Path("data")
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    admin_api_key: str = ""
    model_manifest: str = ""
    clamav_host: str = ""
    clamav_port: int = 3310
    max_upload_bytes: int = 10 * 1024 * 1024
    max_pixels: int = 24_000_000
    rate_limit: int = 30

    @property
    def origins(self) -> list[str]:
        return [s.strip() for s in self.allowed_origins.split(",") if s.strip()]
