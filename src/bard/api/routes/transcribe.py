"""Speech-to-text transcription route."""

import tempfile
import time
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from openai import AsyncOpenAI
from pydantic import BaseModel

from bard.config import get_settings

router = APIRouter(tags=["transcribe"])


class TimingInfo(BaseModel):
    """Timing breakdown for performance measurement."""

    total_ms: float
    file_write_ms: float
    openai_api_ms: float


class TranscriptionResponse(BaseModel):
    """Response model for transcription."""

    text: str
    duration_seconds: float | None = None
    timing: TimingInfo | None = None


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(audio: UploadFile = File(...)) -> TranscriptionResponse:
    """Transcribe audio to text using OpenAI's speech-to-text model.

    Accepts audio in webm, wav, mp3, or other common formats.
    Returns the transcribed text.
    """
    settings = get_settings()

    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    # Validate file type
    content_type = audio.content_type or ""
    valid_types = [
        "audio/webm",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/mp3",
        "audio/mpeg",
        "audio/ogg",
        "audio/mp4",
        "audio/m4a",
    ]

    # Be lenient with content type checking
    if not any(vt in content_type for vt in valid_types) and content_type:
        # Allow if no content type specified (browser quirks)
        if content_type not in ["application/octet-stream", ""]:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid audio format: {content_type}. Supported: webm, wav, mp3, ogg, m4a",
            )

    # Read audio data
    audio_data = await audio.read()

    if len(audio_data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Determine file extension from content type or filename
    ext = ".webm"
    if audio.filename:
        ext = Path(audio.filename).suffix or ext
    elif "wav" in content_type:
        ext = ".wav"
    elif "mp3" in content_type or "mpeg" in content_type:
        ext = ".mp3"
    elif "ogg" in content_type:
        ext = ".ogg"

    # Start timing
    t_start = time.perf_counter()

    # Write to temp file (OpenAI API needs a file-like object with a name)
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name

    t_file_write = time.perf_counter()

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        with open(tmp_path, "rb") as audio_file:
            transcription = await client.audio.transcriptions.create(
                file=audio_file,
                model=settings.stt_model,
            )

        t_openai_done = time.perf_counter()

        # The transcription object is a string for basic response format
        text = transcription.text if hasattr(transcription, "text") else str(transcription)

        # Calculate timing
        timing = TimingInfo(
            total_ms=(t_openai_done - t_start) * 1000,
            file_write_ms=(t_file_write - t_start) * 1000,
            openai_api_ms=(t_openai_done - t_file_write) * 1000,
        )

        return TranscriptionResponse(
            text=text.strip(),
            duration_seconds=None,
            timing=timing,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    finally:
        # Clean up temp file
        Path(tmp_path).unlink(missing_ok=True)
