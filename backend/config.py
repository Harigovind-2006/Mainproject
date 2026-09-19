from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os
from pathlib import Path

# Base backend directory
BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"

    # JWT Config
    SECRET_KEY: str = "fleet-progress-eta-super-secret-key-change-in-production-2025"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Device Secret for Vehicles
    VEHICLE_SECRET_KEY: str = "fleet_device_secret_secure_key_123"

    # MongoDB Atlas
    MONGODB_URI: Optional[str] = None
    DATABASE_NAME: str = "fleet_monitoring"

    # Route & Control Defaults
    DEFAULT_NUM_LANES: int = 4
    DEFAULT_LANE_LENGTH: float = 50.0
    DEFAULT_LANE_SPACING: float = 5.0
    DEFAULT_PLANNED_SPEED: float = 1.5
    DEFAULT_TURN_SPEED: float = 0.8
    V_MIN: float = 0.5
    V_MAX: float = 2.5
    FIXED_STEP_SIZE: float = 0.1
    LOOKAHEAD_SECONDS: float = 3.0

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
