import json
from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "deepseek/deepseek-chat"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    CORS_ORIGINS_RAW: str = '["http://localhost:3000"]'
    GROQ_API_KEY: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def CORS_ORIGINS(self) -> list[str]:
        try:
            return json.loads(self.CORS_ORIGINS_RAW)
        except (json.JSONDecodeError, TypeError):
            return [o.strip().strip('"') for o in self.CORS_ORIGINS_RAW.split(",")]


settings = Settings()
