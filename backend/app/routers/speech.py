import base64
import io
import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

MIME_TO_EXT = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "opus",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/opus": "opus",
}


class SpeechRequest(BaseModel):
    audio: str
    mime_type: str = "audio/webm"


@router.post("/speech-to-text")
async def speech_to_text(body: SpeechRequest):
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Voice input requires a Groq API key. Get a free one at https://console.groq.com",
        )

    try:
        audio_bytes = base64.b64decode(body.audio)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 audio data")

    ext = MIME_TO_EXT.get(body.mime_type, "webm")
    filename = f"recording.{ext}"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(
                GROQ_WHISPER_URL,
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                files={
                    "file": (filename, io.BytesIO(audio_bytes), body.mime_type),
                },
                data={
                    "model": "whisper-large-v3-turbo",
                },
            )

            if response.status_code != 200:
                logger.error("Groq STT error %d: %s", response.status_code, response.text)
                raise HTTPException(
                    status_code=502,
                    detail=f"Transcription service error ({response.status_code})",
                )

            result = response.json()
            return {"text": result.get("text", "")}

        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Transcription timed out")
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("STT error")
            raise HTTPException(status_code=500, detail=str(e))
