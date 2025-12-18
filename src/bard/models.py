"""Pydantic models and data structures for Bard."""

from pydantic import BaseModel, Field


class Chapter(BaseModel):
    """A chapter of the audiobook."""

    chapter_id: int
    title: str
    audio_path: str | None = None
    duration_seconds: float | None = None


class Sentence(BaseModel):
    """A sentence with alignment data."""

    sentence_id: int
    chapter_id: int
    sequence: int  # Order within chapter (0-indexed)
    text: str
    start_time: float | None = None
    end_time: float | None = None


class ChapterWithSentences(Chapter):
    """Chapter with its sentences included."""

    sentences: list[Sentence] = Field(default_factory=list)


class PreparedText(BaseModel):
    """Output of text preparation phase."""

    chapters: list[ChapterWithSentences]
    total_sentences: int


class AlignmentData(BaseModel):
    """Alignment data for a single sentence."""

    sentence_id: int
    start: float
    end: float


class ChapterAlignment(BaseModel):
    """Alignment data for a chapter."""

    chapter_id: int
    sentences: list[AlignmentData]


# API Request/Response Models


class PlaybackPosition(BaseModel):
    """Current playback position in the audiobook."""

    chapter_id: int
    audio_time: float = Field(ge=0, description="Seconds from start of chapter audio")


class AskRequest(BaseModel):
    """Request to ask a question about the audiobook."""

    question: str = Field(min_length=1, max_length=2000)
    chapter_id: int
    audio_time: float = Field(ge=0)


class AskResponse(BaseModel):
    """Response to a question."""

    answer: str
    audio_url: str | None = None
    current_sentence_id: int
    context_sentence_count: int


class ChapterInfo(BaseModel):
    """Chapter information for API responses."""

    chapter_id: int
    title: str
    duration_seconds: float | None
    sentence_count: int


class SentenceAlignment(BaseModel):
    """Sentence alignment info for API responses."""

    sentence_id: int
    sequence: int
    text: str
    start_time: float
    end_time: float

