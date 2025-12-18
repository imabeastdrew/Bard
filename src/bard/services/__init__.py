"""Business logic services for Bard."""

from bard.services.context import build_context, resolve_current_sentence
from bard.services.llm import generate_answer
from bard.services.tts import synthesize_answer

__all__ = ["build_context", "resolve_current_sentence", "generate_answer", "synthesize_answer"]

