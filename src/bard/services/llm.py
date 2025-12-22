"""LLM integration service using OpenAI.

This module handles generating answers to user questions using GPT-5 models
with the new Responses API for optimal performance with reasoning models.
"""

from openai import AsyncOpenAI

from bard.config import get_settings

# Instructions for the narrator (replaces system prompt in Responses API)
NARRATOR_INSTRUCTIONS = """You are Bard, the narrator of this audiobook.

The listener has paused the audiobook to ask you a question. 

CRITICAL RULES:
1. NEVER reveal or hint at events that occur AFTER the current point in the narrative
2. NEVER mention characters who haven't been introduced yet
3. If the listener asks about something that would spoil future events, politely explain that you cannot reveal what happens next
4. Keep answers conversational, engaging, and succinct, as if speaking to a curious listener
5. Aim for concise but complete answers (1-2 sentences for simple questions, more for complex topics)
"""


async def generate_answer(context: str, question: str) -> str:
    """Generate an answer to a question using OpenAI Responses API.

    Uses the new Responses API which is optimized for GPT-5 reasoning models.
    Reasoning effort is set to 'none' for minimal latency.

    Args:
        context: The narrative context (all text heard so far)
        question: The user's question

    Returns:
        The generated answer text
    """
    settings = get_settings()

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not set in environment")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # Build the user input with context
    user_input = f"""NARRATIVE CONTEXT (everything the listener has heard so far):
{context}

---

LISTENER'S QUESTION: {question}"""

    # Use the new Responses API with reasoning effort set to none
    response = await client.responses.create(
        model=settings.openai_model,
        instructions=NARRATOR_INSTRUCTIONS,
        input=user_input,
        reasoning={"effort": "minimal"},  # Minimal reasoning for low latency
    )

    # Get the output text from the response
    answer = response.output_text
    if answer is None:
        raise ValueError("No response generated from OpenAI")

    return answer.strip()


async def generate_answer_streaming(context: str, question: str):
    """Generate an answer with streaming response using Responses API.

    Yields text chunks as they're generated.
    """
    settings = get_settings()

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not set in environment")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    user_input = f"""NARRATIVE CONTEXT (everything the listener has heard so far):
{context}

---

LISTENER'S QUESTION: {question}"""

    # Use streaming with the Responses API
    stream = await client.responses.create(
        model=settings.openai_model,
        instructions=NARRATOR_INSTRUCTIONS,
        input=user_input,
        reasoning={"effort": "minimal"},  # Minimal reasoning for low latency
        stream=True,
    )

    async for event in stream:
        # Handle text delta events
        if event.type == "response.output_text.delta":
            yield event.delta
