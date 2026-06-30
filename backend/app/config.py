from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-3.5-turbo"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    GROQ_API_KEY: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
