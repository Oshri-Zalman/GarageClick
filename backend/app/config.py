"""Application configuration, loaded from environment variables (.env)."""
import os

from dotenv import load_dotenv

# load_dotenv does NOT override variables already present in the environment,
# which lets the test suite force DB_NAME=garageclick_test before import.
load_dotenv()


class Settings:
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "garageclick")
    DB_NAME_TEST: str = os.getenv("DB_NAME_TEST", "garageclick_test")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev_insecure_secret_change_me")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_HOURS: int = int(os.getenv("JWT_EXPIRES_HOURS", "8"))

    def database_url(self, db_name: str | None = None) -> str:
        """SQLAlchemy URL for the given database (defaults to DB_NAME)."""
        name = db_name or self.DB_NAME
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{name}?charset=utf8mb4"
        )

    def server_url(self) -> str:
        """URL to the server WITHOUT a database (for CREATE DATABASE)."""
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/?charset=utf8mb4"
        )


settings = Settings()
