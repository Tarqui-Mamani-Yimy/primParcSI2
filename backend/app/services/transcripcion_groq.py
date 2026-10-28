import httpx

from app.config import get_settings

GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


class TranscripcionNoConfigurada(RuntimeError):
    """Raised when the Groq API key is not configured."""


class TranscripcionError(RuntimeError):
    """Raised when the transcription provider request or response fails."""


async def transcribir_audio(audio: bytes, filename: str, content_type: str) -> str:
    settings = get_settings()
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise TranscripcionNoConfigurada

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                GROQ_TRANSCRIPTIONS_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                data={
                    "model": settings.GROQ_TRANSCRIPTION_MODEL,
                    "language": "es",
                },
                files={"file": (filename, audio, content_type)},
            )
            response.raise_for_status()
            result = response.json()
    except httpx.HTTPError as exc:
        raise TranscripcionError from exc
    except (TypeError, ValueError) as exc:
        raise TranscripcionError from exc

    text = result.get("text") if isinstance(result, dict) else None
    if not isinstance(text, str):
        raise TranscripcionError("Groq returned an invalid transcription response")
    return text
