"""Context assembly service for RAG.

This module builds the narrative context for the LLM based on the current
playback position. It includes all sentences up to and including the current
sentence being spoken.
"""

import tiktoken

from bard.config import get_settings
from bard.database import find_sentence_at_time, get_context_sentences
from bard.models import Sentence


def resolve_current_sentence(chapter_id: int, audio_time: float) -> Sentence:
    """Resolve the current sentence from playback position.

    Args:
        chapter_id: Current chapter being played
        audio_time: Seconds from start of chapter audio

    Returns:
        The sentence being spoken at the given time

    Raises:
        ValueError: If no sentence can be found
    """
    sentence = find_sentence_at_time(chapter_id, audio_time)
    if sentence is None:
        raise ValueError(f"Could not resolve sentence for chapter {chapter_id} at {audio_time}s")
    return sentence


def build_context(current_sentence_id: int, max_tokens: int | None = None) -> str:
    """Build narrative context from all sentences up to the current one.

    The context includes:
    - All sentences from previous chapters
    - All sentences in the current chapter up to and including current_sentence_id
    - The full current sentence (even if interrupted mid-speech)

    Args:
        current_sentence_id: The sentence ID to build context up to
        max_tokens: Maximum tokens to include (truncates from beginning if needed)

    Returns:
        Formatted context string with all relevant text
    """
    settings = get_settings()
    if max_tokens is None:
        max_tokens = settings.max_context_tokens

    # Get all sentences up to current
    sentences = get_context_sentences(current_sentence_id)

    if not sentences:
        return ""

    # Build context text
    context_parts: list[str] = []
    current_chapter = None

    for sentence in sentences:
        # Add chapter header when chapter changes
        if sentence.chapter_id != current_chapter:
            current_chapter = sentence.chapter_id
            context_parts.append(f"\n--- Chapter {current_chapter} ---\n")

        context_parts.append(sentence.text)

    context = " ".join(context_parts)

    # Truncate if needed (from the beginning to keep recent context)
    if max_tokens:
        context = truncate_to_tokens(context, max_tokens)

    return context.strip()


def truncate_to_tokens(text: str, max_tokens: int) -> str:
    """Truncate text to fit within token limit, keeping the end.

    Uses tiktoken for accurate token counting.
    """
    try:
        encoding = tiktoken.encoding_for_model("gpt-4o")
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    tokens = encoding.encode(text)

    if len(tokens) <= max_tokens:
        return text

    # Keep the last max_tokens tokens
    truncated_tokens = tokens[-max_tokens:]
    truncated_text = encoding.decode(truncated_tokens)

    # Find the start of a sentence to avoid starting mid-sentence
    # Look for ". " or "--- Chapter" pattern
    sentence_start = truncated_text.find(". ")
    chapter_start = truncated_text.find("--- Chapter")

    if chapter_start != -1 and chapter_start < 200:
        # Start at chapter boundary if near the beginning
        return truncated_text[chapter_start:]
    elif sentence_start != -1 and sentence_start < 100:
        # Start at sentence boundary
        return truncated_text[sentence_start + 2 :]

    # Otherwise just add ellipsis
    return "... " + truncated_text


def get_context_stats(current_sentence_id: int) -> dict:
    """Get statistics about the context at a given position.

    Returns:
        Dict with sentence_count, chapter_count, estimated_tokens
    """
    sentences = get_context_sentences(current_sentence_id)

    if not sentences:
        return {"sentence_count": 0, "chapter_count": 0, "estimated_tokens": 0}

    chapters = set(s.chapter_id for s in sentences)
    total_text = " ".join(s.text for s in sentences)

    try:
        encoding = tiktoken.encoding_for_model("gpt-4o")
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")

    token_count = len(encoding.encode(total_text))

    return {
        "sentence_count": len(sentences),
        "chapter_count": len(chapters),
        "estimated_tokens": token_count,
    }

