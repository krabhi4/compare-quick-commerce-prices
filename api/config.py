import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Quick-Commerce Price Comparison"
    app_version: str = "1.0.0"
    debug: bool = False

    default_pin: str = "110001"
    default_lat: float = 28.4600
    default_lon: float = 77.0600

    data_dir: Path = Path("data")
    database_url: str = "sqlite+aiosqlite:///data/comparator.db"

    alert_check_interval_seconds: int = 900
    cache_ttl_seconds: int = 300
    scraper_timeout_seconds: int = 30

    enable_blinkit: bool = True
    enable_zepto: bool = True
    enable_instamart: bool = True
    enable_flipkart: bool = True
    enable_bigbasket: bool = True


settings = Settings()
os.makedirs(settings.data_dir, exist_ok=True)
os.makedirs(settings.data_dir / "profiles", exist_ok=True)
os.makedirs(settings.data_dir / "debug", exist_ok=True)
