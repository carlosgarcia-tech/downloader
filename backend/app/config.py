from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory (this file lives in backend/app/config.py)
_base_dir = Path(__file__).resolve().parent.parent
# repo root (parent of backend/)
_project_root = _base_dir.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    host: str = "0.0.0.0"
    port: int = 8000
    max_concurrent_downloads: int = 4
    # Assets and data live at the repo root (shared with Docker volumes)
    downloads_dir: Path = _project_root / "downloads"
    # Static frontend: the Vite build output (frontend/ built into backend/frontend)
    frontend_dir: Path = _base_dir / "frontend"
    database_url: str = f"sqlite+aiosqlite:///{_project_root / 'data' / 'jobs.db'}"
    log_level: str = "INFO"
    cors_origins: list[str] = ["*"]


settings = Settings()
settings.downloads_dir.mkdir(parents=True, exist_ok=True)
settings.frontend_dir.mkdir(parents=True, exist_ok=True)
(_base_dir / "data").mkdir(parents=True, exist_ok=True)
