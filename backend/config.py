from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str = "sqlite:///./data/crab.db"
    data_dir: Path = Path("data")
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    admin_api_key: str = ""
    model_manifest: str = ""
    experimental_classifier: str = ""
    use_bundled_classifier: bool = True
    clamav_host: str = ""
    clamav_port: int = 3310
    max_upload_bytes: int = 10 * 1024 * 1024
    max_pixels: int = 24_000_000
    rate_limit: int = 30

    @model_validator(mode="after")
    def select_bundled_classifier(self):
        if (self.app_env == "development" and self.use_bundled_classifier
                and not self.experimental_classifier.strip() and not self.model_manifest.strip()):
            self.experimental_classifier = str(
                Path(__file__).resolve().parents[1]
                / "runs/classify/crabs-yolov8n-2/weights/best.pt"
            )
        return self

    @property
    def origins(self) -> list[str]:
        return [s.strip() for s in self.allowed_origins.split(",") if s.strip()]
