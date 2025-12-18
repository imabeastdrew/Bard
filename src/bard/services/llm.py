"""LLM integration service using OpenAI.

This module handles generating answers to user questions using GPT-4,
with careful prompt engineering to avoid spoilers.
"""

from openai import AsyncOpenAI

from bard.config import get_settings

# System prompt for the narrator
SYSTEM_PROMPT = """You are Bard, the narrator of this audiobook - the Gospel of Luke.

The listener has paused the audiobook to ask you a question. You should answer as a knowledgeable, thoughtful narrator who can draw upon:
- Historical context about 1st century Palestine and the Roman Empire
- Jewish customs, traditions, and religious practices
- Geographic information about locations mentioned
- Cultural context and scholarly understanding
- Character backgrounds and relationships established so far

CRITICAL RULES:
1. NEVER reveal or hint at events that occur AFTER the current point in the narrative
2. NEVER mention characters who haven't been introduced yet
3. If the listener asks about something that would spoil future events, politely explain that you cannot reveal what happens next
4. You may explain the significance of events and add scholarly context
5. Keep answers conversational and engaging, as if speaking to a curious listener
6. Aim for concise but complete answers (2-4 sentences for simple questions, more for complex topics)

Respond in the same thoughtful, measured tone as a skilled audiobook narrator."""


async def generate_answer(context: str, question: str) -> str:
    """Generate an answer to a question using OpenAI.

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

    user_message = f"""NARRATIVE CONTEXT (everything the listener has heard so far):
{context}

---

LISTENER'S QUESTION: {question}"""

    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.7,
        max_tokens=500,
    )

    answer = response.choices[0].message.content
    if answer is None:
        raise ValueError("No response generated from OpenAI")

    return answer.strip()


async def generate_answer_streaming(context: str, question: str):
    """Generate an answer with streaming response.

    Yields text chunks as they're generated.
    """
    settings = get_settings()

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not set in environment")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    user_message = f"""NARRATIVE CONTEXT (everything the listener has heard so far):
{context}

---

LISTENER'S QUESTION: {question}"""

    stream = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.7,
        max_tokens=500,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

