"""Agent configuration routes for ElevenLabs Conversational AI."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from bard.config import get_settings
from bard.database import get_chapter_alignment, get_chapter

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentConfigResponse(BaseModel):
    """Response model for agent configuration."""

    agent_id: str
    voice_id: str
    use_agent: bool
    conversation_timeout_ms: int
    max_context_words: int


class AgentSystemPrompt(BaseModel):
    """The system prompt used for the ElevenLabs agent."""

    prompt: str
    instructions: str


@router.get("/config", response_model=AgentConfigResponse)
async def get_agent_config() -> AgentConfigResponse:
    """Get the ElevenLabs agent configuration for the frontend.
    
    Returns agent ID and settings needed to initialize the conversation.
    """
    settings = get_settings()

    if not settings.elevenlabs_agent_id:
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs agent not configured. Set ELEVENLABS_AGENT_ID in environment.",
        )

    return AgentConfigResponse(
        agent_id=settings.elevenlabs_agent_id,
        voice_id=settings.elevenlabs_voice_id,
        use_agent=settings.use_elevenlabs_agent,
        conversation_timeout_ms=settings.conversation_timeout_ms,
        max_context_words=settings.max_context_words,
    )


@router.get("/system-prompt", response_model=AgentSystemPrompt)
async def get_system_prompt() -> AgentSystemPrompt:
    """Get the system prompt to configure in the ElevenLabs agent dashboard.
    
    This is provided as a reference for setting up the agent.
    """
    prompt = """You are Bard, the narrator of this audiobook - the Gospel of Luke.

The listener has paused the audiobook to ask you a question. Answer as a knowledgeable narrator drawing upon historical context, Jewish customs, geography, and character backgrounds.

CRITICAL RULES:
1. NEVER reveal events that occur AFTER the current point in the narrative
2. NEVER mention characters who haven't been introduced yet
3. If asked about future events, explain you cannot reveal what happens next
4. Keep answers concise (2-4 sentences for simple questions)

The listener's current position in the audiobook will be provided via context updates."""

    instructions = """Configure this agent in ElevenLabs dashboard with:
1. Name: "Bard - Gospel of Luke Narrator"
2. System Prompt: Use the prompt above
3. Voice: Set to your narrator voice ID
4. Turn Eagerness: Patient (for thoughtful Q&A)
5. Interruptions: Enabled
6. Tools: Add 'resume_audiobook' as a client tool"""

    return AgentSystemPrompt(prompt=prompt, instructions=instructions)


class ContextResponse(BaseModel):
    """Response model for audiobook context."""

    chapter_id: int
    chapter_title: str
    sentence_id: int | None
    current_sentence: str | None
    text_heard_so_far: str
    word_count: int


@router.get("/context", response_model=ContextResponse)
async def get_context(
    chapter_id: int = Query(..., description="Current chapter ID"),
    audio_time: float = Query(..., description="Current audio playback time in seconds"),
) -> ContextResponse:
    """Get the audiobook context for a given position.
    
    Returns the text heard so far up to the current audio time,
    truncated to the configured max words for efficient context injection.
    """
    settings = get_settings()
    
    # Get chapter info
    chapter = get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")
    
    # Get alignment data
    alignment = get_chapter_alignment(chapter_id)
    if not alignment:
        raise HTTPException(
            status_code=404, 
            detail=f"Alignment not available for chapter {chapter_id}"
        )
    
    # Find current sentence
    current_sentence = None
    current_sentence_id = None
    for sentence in alignment:
        if audio_time >= sentence.start_time and audio_time <= sentence.end_time:
            current_sentence = sentence.text
            current_sentence_id = sentence.sentence_id
            break
    
    # Get all sentences heard so far
    sentences_heard = [s.text for s in alignment if s.end_time <= audio_time]
    text_heard = " ".join(sentences_heard)
    
    # Truncate to max words (keep recent context)
    max_words = settings.max_context_words
    words = text_heard.split()
    word_count = len(words)
    
    if word_count > max_words:
        text_heard = "..." + " ".join(words[-max_words:])
        word_count = max_words
    
    return ContextResponse(
        chapter_id=chapter_id,
        chapter_title=chapter.title,
        sentence_id=current_sentence_id,
        current_sentence=current_sentence,
        text_heard_so_far=text_heard,
        word_count=word_count,
    )
