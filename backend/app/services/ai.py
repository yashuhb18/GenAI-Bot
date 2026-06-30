import json
import logging
from collections.abc import AsyncGenerator

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def stream_chat(messages: list[dict]) -> AsyncGenerator[str]:
    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": messages,
        "stream": True,
        "temperature": 0.85,
        "top_p": 0.9,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AvenZa-AI",
            },
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                logger.error("OpenRouter error %d: %s", response.status_code, body.decode())
                yield f"⚠️ API error ({response.status_code}). Check your API key or try again."
                return

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                chunk = line[6:]
                if chunk == "[DONE]":
                    break
                try:
                    data = json.loads(chunk)
                except json.JSONDecodeError:
                    continue
                choices = data.get("choices", [])
                if not choices:
                    continue
                delta = choices[0].get("delta", {})
                content = delta.get("content", "")
                if content:
                    yield content
