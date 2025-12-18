"""Question-answering routes for the Ask Bard feature."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from bard.models import AskRequest, AskResponse
from bard.services.context import build_context, get_context_stats, resolve_current_sentence
from bard.services.llm import generate_answer
from bard.services.tts import get_answer_audio_path, synthesize_answer

router = APIRouter(tags=["qa"])


@router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest) -> AskResponse:
    """Ask a question about the audiobook at the current playback position.

    This endpoint:
    1. Resolves the current sentence from (chapter_id, audio_time)
    2. Builds context from all sentences up to current position
    3. Generates an answer using OpenAI (avoiding spoilers)
    4. Synthesizes the answer to audio using ElevenLabs

    The answer uses the same narrator voice as the audiobook.
    """
    try:
        # 1. Resolve current sentence from playback position
        current_sentence = resolve_current_sentence(request.chapter_id, request.audio_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. Build narrative context (all text up to current sentence)
    context = build_context(current_sentence.sentence_id)
    context_stats = get_context_stats(current_sentence.sentence_id)

    if not context:
        raise HTTPException(
            status_code=400, detail="No narrative context available at this position"
        )

    # 3. Generate answer using OpenAI
    try:
        answer_text = await generate_answer(context, request.question)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {e}")

    # 4. Synthesize answer to audio
    try:
        audio_url = await synthesize_answer(answer_text)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {e}")
    except Exception as e:
        # Return answer without audio if TTS fails
        audio_url = None

    return AskResponse(
        answer=answer_text,
        audio_url=audio_url,
        current_sentence_id=current_sentence.sentence_id,
        context_sentence_count=context_stats["sentence_count"],
    )


@router.post("/ask/text-only")
async def ask_question_text_only(request: AskRequest) -> dict:
    """Ask a question and get only the text response (no audio synthesis).

    Useful for testing or when audio isn't needed.
    """
    try:
        current_sentence = resolve_current_sentence(request.chapter_id, request.audio_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    context = build_context(current_sentence.sentence_id)
    context_stats = get_context_stats(current_sentence.sentence_id)

    if not context:
        raise HTTPException(status_code=400, detail="No narrative context available")

    try:
        answer_text = await generate_answer(context, request.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {e}")

    return {
        "answer": answer_text,
        "current_sentence_id": current_sentence.sentence_id,
        "current_sentence_text": current_sentence.text,
        "context_sentence_count": context_stats["sentence_count"],
        "context_chapter_count": context_stats["chapter_count"],
        "context_tokens": context_stats["estimated_tokens"],
    }


@router.get("/answers/{answer_id}/audio")
async def get_answer_audio(answer_id: str) -> FileResponse:
    """Retrieve a generated answer audio file."""
    audio_path = get_answer_audio_path(answer_id)

    if audio_path is None:
        raise HTTPException(status_code=404, detail="Answer audio not found")

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=f"bard_answer_{answer_id}.mp3",
    )


@router.get("/context/{chapter_id}/{audio_time}")
async def get_context_preview(chapter_id: int, audio_time: float) -> dict:
    """Preview the context that would be used for a question at this position.

    Useful for debugging and understanding what the LLM will see.
    """
    try:
        current_sentence = resolve_current_sentence(chapter_id, audio_time)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    context = build_context(current_sentence.sentence_id)
    stats = get_context_stats(current_sentence.sentence_id)

    # Truncate context for preview (don't send the whole thing)
    context_preview = context[:2000] + "..." if len(context) > 2000 else context

    return {
        "current_sentence_id": current_sentence.sentence_id,
        "current_sentence_text": current_sentence.text,
        "current_chapter_id": current_sentence.chapter_id,
        "context_preview": context_preview,
        "stats": stats,
    }

