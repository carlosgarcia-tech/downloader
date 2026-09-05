from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8000
    max_concurrent_downloads: int = 2
    downloads_dir: Path = Path(__file__).resolve().parent.parent.parent / "downloads"
    frontend_dir: Path = Path(__file__).resolve().parent.parent.parent / "frontend"
    database_url: str = "sqlite+aiosqlite:///./data/jobs.db"
    log_level: str = "INFO"
    cors_origins: list[str] = ["*"]


settings = Settings()
settings.downloads_dir.mkdir(parents=True, exist_ok=True)
settings.frontend_dir.mkdir(parents=True, exist_ok=True)
