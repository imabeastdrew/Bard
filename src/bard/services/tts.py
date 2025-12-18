"""TTS service for generating spoken answers.

This module uses ElevenLabs to synthesize answer audio using the same
voice as the audiobook narration.
"""

import uuid
from pathlib import Path

from elevenlabs import ElevenLabs

from bard.config import get_settings


def get_elevenlabs_client() -> ElevenLabs:
    """Create ElevenLabs client with API key from settings."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise ValueError("ELEVENLABS_API_KEY not set in environment")
    return ElevenLabs(api_key=settings.elevenlabs_api_key)


async def synthesize_answer(answer_text: str) -> str:
    """Synthesize answer text to audio using ElevenLabs.

    Uses the same voice_id as the audiobook narration for consistency.

    Args:
        answer_text: The text answer to synthesize

    Returns:
        URL path to the generated audio file (relative to API)
    """
    settings = get_settings()

    if not settings.elevenlabs_voice_id:
        raise ValueError("ELEVENLABS_VOICE_ID not set in environment")

    client = get_elevenlabs_client()

    # Generate unique filename for this answer
    answer_id = str(uuid.uuid4())[:8]
    answers_dir = settings.get_data_path() / "answers"
    answers_dir.mkdir(parents=True, exist_ok=True)
    audio_path = answers_dir / f"answer_{answer_id}.mp3"

    # Generate audio
    audio_generator = client.text_to_speech.convert(
        voice_id=settings.elevenlabs_voice_id,
        text=answer_text,
        model_id=settings.tts_model_id,
        output_format=settings.tts_output_format,
    )

    # Write to file
    with open(audio_path, "wb") as f:
        for chunk in audio_generator:
            f.write(chunk)

    # Return URL path for the API to serve
    return f"/answers/{answer_id}/audio"


def get_answer_audio_path(answer_id: str) -> Path | None:
    """Get the path to an answer audio file."""
    settings = get_settings()
    audio_path = settings.get_data_path() / "answers" / f"answer_{answer_id}.mp3"
    if audio_path.exists():
        return audio_path
    return None


async def synthesize_answer_streaming(answer_text: str):
    """Synthesize answer with streaming audio output.

    Yields audio chunks as they're generated.
    """
    settings = get_settings()

    if not settings.elevenlabs_voice_id:
        raise ValueError("ELEVENLABS_VOICE_ID not set in environment")

    client = get_elevenlabs_client()

    # Use streaming endpoint
    audio_stream = client.text_to_speech.convert(
        voice_id=settings.elevenlabs_voice_id,
        text=answer_text,
        model_id=settings.tts_model_id,
        output_format=settings.tts_output_format,
    )

    for chunk in audio_stream:
        yield chunk

