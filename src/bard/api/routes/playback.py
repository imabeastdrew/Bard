"""Playback routes for audio streaming and alignment data."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from bard.config import get_settings
from bard.database import get_all_chapters, get_chapter, get_chapter_alignment
from bard.models import ChapterInfo, SentenceAlignment

router = APIRouter(prefix="/chapters", tags=["playback"])


@router.get("", response_model=list[ChapterInfo])
async def list_chapters() -> list[ChapterInfo]:
    """List all chapters with metadata."""
    return get_all_chapters()


@router.get("/{chapter_id}", response_model=ChapterInfo)
async def get_chapter_info(chapter_id: int) -> ChapterInfo:
    """Get information about a specific chapter."""
    chapters = get_all_chapters()
    for chapter in chapters:
        if chapter.chapter_id == chapter_id:
            return chapter
    raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")


@router.get("/{chapter_id}/audio")
async def get_chapter_audio(chapter_id: int) -> FileResponse:
    """Stream chapter audio file."""
    chapter = get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")

    if not chapter.audio_path:
        raise HTTPException(status_code=404, detail=f"Audio not generated for chapter {chapter_id}")

    settings = get_settings()
    audio_path = settings.get_data_path() / chapter.audio_path

    if not audio_path.exists():
        raise HTTPException(status_code=404, detail=f"Audio file not found: {chapter.audio_path}")

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=f"luke_chapter_{chapter_id}.mp3",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000",
        },
    )


@router.get("/{chapter_id}/alignment", response_model=list[SentenceAlignment])
async def get_alignment(chapter_id: int) -> list[SentenceAlignment]:
    """Get sentence alignment data for a chapter."""
    chapter = get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")

    alignment = get_chapter_alignment(chapter_id)
    if not alignment:
        raise HTTPException(
            status_code=404, detail=f"Alignment not generated for chapter {chapter_id}"
        )

    return alignment

