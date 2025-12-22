"""Run the complete preprocessing pipeline for Bard.

This script orchestrates:
1. Text preparation (download, normalize, split sentences)
2. Database ingestion
3. TTS audio generation
4. Aeneas alignment
"""

import argparse
import sys

from bard.config import get_settings
from bard.preprocessing.alignment import align_all_chapters, validate_alignments
from bard.preprocessing.text_prep import ingest_to_database, load_prepared_text, prepare_luke_text
from bard.preprocessing.tts_generation import generate_all_chapters


def check_prerequisites() -> list[str]:
    """Check that all prerequisites are met."""
    issues = []
    settings = get_settings()

    # Check API keys (only for TTS step)
    if not settings.elevenlabs_api_key:
        issues.append("ELEVENLABS_API_KEY not set (required for TTS generation)")
    if not settings.elevenlabs_voice_id:
        issues.append("ELEVENLABS_VOICE_ID not set (required for TTS generation)")

    # Check for Aeneas (alignment step)
    try:
        import subprocess

        result = subprocess.run(
            ["python", "-m", "aeneas.tools.execute_task", "--version"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            issues.append("Aeneas not properly installed (required for alignment)")
    except Exception:
        issues.append("Aeneas not found (required for alignment)")

    return issues


def run_pipeline(
    skip_text: bool = False,
    skip_tts: bool = False,
    skip_alignment: bool = False,
    force: bool = False,
) -> None:
    """Run the complete preprocessing pipeline.

    Args:
        skip_text: Skip text preparation step
        skip_tts: Skip TTS generation step
        skip_alignment: Skip alignment step
        force: Force regeneration of all assets
    """
    settings = get_settings()
    data_dir = settings.get_data_path()

    print("=" * 60)
    print("Bard Preprocessing Pipeline")
    print("=" * 60)
    print()

    # Step 1: Text Preparation
    if not skip_text:
        print("STEP 1: Text Preparation")
        print("-" * 40)

        prepared = load_prepared_text()
        if prepared is None or force:
            prepared = prepare_luke_text()
        else:
            print("Using existing prepared text")

        ingest_to_database(prepared)
        print(f"Total sentences: {prepared.total_sentences}")
        print()
    else:
        print("STEP 1: Text Preparation [SKIPPED]")
        print()

    # Step 2: TTS Generation
    if not skip_tts:
        print("STEP 2: TTS Audio Generation")
        print("-" * 40)

        # Check API keys
        if not settings.elevenlabs_api_key or not settings.elevenlabs_voice_id:
            print("ERROR: ElevenLabs API key and voice ID required")
            print("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env")
            sys.exit(1)

        generate_all_chapters(force=force)
        print()
    else:
        print("STEP 2: TTS Audio Generation [SKIPPED]")
        print()

    # Step 3: Alignment
    if not skip_alignment:
        print("STEP 3: Aeneas Alignment")
        print("-" * 40)
        align_all_chapters(force=force)
        print()

        print("Validating alignments...")
        validate_alignments()
        print()
    else:
        print("STEP 3: Aeneas Alignment [SKIPPED]")
        print()

    print("=" * 60)
    print("Pipeline Complete!")
    print("=" * 60)

    # Summary
    print()
    print("Summary:")
    print(f"  Data directory: {data_dir}")
    print(f"  Database: {settings.get_db_path()}")
    print(f"  Audio files: {settings.get_audio_path()}")
    print()
    print("Next steps:")
    print("  1. Start the backend: bard-serve")
    print("  2. Start the frontend: cd frontend && npm run dev")


def main() -> None:
    """Entry point for bard-preprocess command."""
    parser = argparse.ArgumentParser(
        description="Run the Bard preprocessing pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  bard-preprocess                    # Run full pipeline
  bard-preprocess --skip-tts         # Prepare text only
  bard-preprocess --skip-text        # Generate TTS and align (text must exist)
  bard-preprocess --force            # Regenerate all assets
        """,
    )
    parser.add_argument("--skip-text", action="store_true", help="Skip text preparation")
    parser.add_argument("--skip-tts", action="store_true", help="Skip TTS generation")
    parser.add_argument("--skip-alignment", action="store_true", help="Skip alignment")
    parser.add_argument("--force", action="store_true", help="Force regeneration")
    parser.add_argument("--check", action="store_true", help="Check prerequisites only")

    args = parser.parse_args()

    if args.check:
        print("Checking prerequisites...")
        issues = check_prerequisites()
        if issues:
            print("Issues found:")
            for issue in issues:
                print(f"  - {issue}")
            sys.exit(1)
        else:
            print("All prerequisites met!")
            sys.exit(0)

    run_pipeline(
        skip_text=args.skip_text,
        skip_tts=args.skip_tts,
        skip_alignment=args.skip_alignment,
        force=args.force,
    )


if __name__ == "__main__":
    main()
