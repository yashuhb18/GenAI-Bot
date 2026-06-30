import os
from dotenv import load_dotenv

def load_config():
    load_dotenv()
    return {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "model": os.getenv("OPENAI_MODEL", "openai/gpt-3.5-turbo"),
        "base_url": os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1"),
    }