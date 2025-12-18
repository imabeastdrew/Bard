"""TTS audio generation using ElevenLabs.

This module generates one audio file per chapter using ElevenLabs TTS API.
"""

import time
from pathlib import Path

from elevenlabs import ElevenLabs
from mutagen.mp3 import MP3

from bard.config import get_settings
from bard.database import get_all_chapters, get_chapter_sentences, update_chapter_audio
from bard.preprocessing.text_prep import load_prepared_text


def get_elevenlabs_client() -> ElevenLabs:
    """Create ElevenLabs client with API key from settings."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise ValueError("ELEVENLABS_API_KEY not set in environment")
    return ElevenLabs(api_key=settings.elevenlabs_api_key)


def build_chapter_text(chapter_id: int) -> str:
    """Build the full text for a chapter by concatenating sentences.

    Sentences are joined with newlines to provide natural pauses in TTS.
    """
    sentences = get_chapter_sentences(chapter_id)
    return "\n".join(s.text for s in sentences)


def generate_chapter_audio(
    chapter_id: int,
    client: ElevenLabs | None = None,
    force: bool = False,
) -> Path:
    """Generate audio for a single chapter.

    Args:
        chapter_id: The chapter to generate audio for
        client: Optional ElevenLabs client (created if not provided)
        force: If True, regenerate even if audio exists

    Returns:
        Path to the generated audio file
    """
    settings = get_settings()
    audio_dir = settings.get_audio_path()
    audio_dir.mkdir(parents=True, exist_ok=True)

    audio_path = audio_dir / f"chapter_{chapter_id}.mp3"

    # Skip if already exists (unless force)
    if audio_path.exists() and not force:
        print(f"  Audio already exists: {audio_path}")
        return audio_path

    if client is None:
        client = get_elevenlabs_client()

    if not settings.elevenlabs_voice_id:
        raise ValueError("ELEVENLABS_VOICE_ID not set in environment")

    # Build chapter text
    chapter_text = build_chapter_text(chapter_id)
    char_count = len(chapter_text)
    print(f"  Chapter {chapter_id}: {char_count} characters")

    # Generate audio using ElevenLabs
    print(f"  Generating audio with voice {settings.elevenlabs_voice_id}...")
    audio_generator = client.text_to_speech.convert(
        voice_id=settings.elevenlabs_voice_id,
        text=chapter_text,
        model_id=settings.tts_model_id,
        output_format=settings.tts_output_format,
    )

    # Write audio to file (generator yields bytes)
    with open(audio_path, "wb") as f:
        for chunk in audio_generator:
            f.write(chunk)

    print(f"  Saved to {audio_path}")

    # Get duration using mutagen
    duration = get_audio_duration(audio_path)
    print(f"  Duration: {duration:.2f} seconds")

    # Update database with audio path and duration
    relative_path = f"audio/chapter_{chapter_id}.mp3"
    update_chapter_audio(chapter_id, relative_path, duration)

    return audio_path


def get_audio_duration(audio_path: Path) -> float:
    """Get audio duration in seconds using mutagen."""
    audio = MP3(audio_path)
    return audio.info.length


def generate_all_chapters(force: bool = False, start_chapter: int = 1) -> None:
    """Generate audio for all chapters.

    Args:
        force: If True, regenerate all audio even if it exists
        start_chapter: Chapter to start from (useful for resuming)
    """
    settings = get_settings()

    # Check for required credentials
    if not settings.elevenlabs_api_key:
        raise ValueError("ELEVENLABS_API_KEY not set. Please configure in .env file.")
    if not settings.elevenlabs_voice_id:
        raise ValueError("ELEVENLABS_VOICE_ID not set. Please configure in .env file.")

    # Load prepared text to ensure data is in database
    prepared = load_prepared_text()
    if prepared is None:
        raise ValueError("No prepared text found. Run text_prep.py first.")

    client = get_elevenlabs_client()
    chapters = get_all_chapters()

    print(f"Generating audio for {len(chapters)} chapters...")
    print(f"Using voice: {settings.elevenlabs_voice_id}")
    print(f"Using model: {settings.tts_model_id}")
    print()

    for chapter in chapters:
        if chapter.chapter_id < start_chapter:
            continue

        print(f"Chapter {chapter.chapter_id}: {chapter.title}")

        try:
            generate_chapter_audio(chapter.chapter_id, client=client, force=force)
        except Exception as e:
            print(f"  ERROR: {e}")
            print("  Waiting 60 seconds before retry...")
            time.sleep(60)
            try:
                generate_chapter_audio(chapter.chapter_id, client=client, force=force)
            except Exception as e2:
                print(f"  FAILED: {e2}")
                raise

        # Rate limiting: ElevenLabs has limits, add small delay between chapters
        print("  Waiting 2 seconds (rate limiting)...")
        time.sleep(2)
        print()

    print("Audio generation complete!")


def main() -> None:
    """Run TTS generation as standalone script."""
    import argparse

    parser = argparse.ArgumentParser(description="Generate audiobook audio using ElevenLabs TTS")
    parser.add_argument("--force", action="store_true", help="Regenerate all audio")
    parser.add_argument("--start", type=int, default=1, help="Chapter to start from")
    parser.add_argument("--chapter", type=int, help="Generate single chapter only")
    args = parser.parse_args()

    if args.chapter:
        print(f"Generating audio for chapter {args.chapter}...")
        generate_chapter_audio(args.chapter, force=args.force)
    else:
        generate_all_chapters(force=args.force, start_chapter=args.start)


if __name__ == "__main__":
    main()

