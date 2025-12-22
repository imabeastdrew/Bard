"""Audio-text alignment using Aeneas.

This module aligns chapter audio with sentence text to produce timestamps.
"""

import json
import subprocess
import tempfile
from pathlib import Path

from bard.config import get_settings
from bard.database import (
    get_all_chapters,
    get_chapter_sentences,
    update_alignments_batch,
)
from bard.models import AlignmentData, ChapterAlignment


def create_sentence_file(chapter_id: int, temp_dir: Path) -> Path:
    """Create a text file with one sentence per line for Aeneas input."""
    sentences = get_chapter_sentences(chapter_id)
    text_path = temp_dir / f"chapter_{chapter_id}.txt"

    with open(text_path, "w", encoding="utf-8") as f:
        for sentence in sentences:
            # Write each sentence on its own line
            f.write(sentence.text + "\n")

    return text_path


def run_aeneas_alignment(
    audio_path: Path,
    text_path: Path,
    output_path: Path,
) -> dict:
    """Run Aeneas to align audio with text.

    Uses the aeneas command-line tool for alignment.

    Args:
        audio_path: Path to the chapter audio file
        text_path: Path to the sentence text file
        output_path: Path for JSON output

    Returns:
        Parsed JSON alignment data
    """
    # Aeneas configuration
    # task_language=eng: English
    # is_text_type=plain: One sentence per line
    # os_task_file_format=json: Output as JSON
    config = "task_language=eng|is_text_type=plain|os_task_file_format=json"

    cmd = [
        "python",
        "-m",
        "aeneas.tools.execute_task",
        str(audio_path),
        str(text_path),
        config,
        str(output_path),
    ]

    print(f"  Running: {' '.join(cmd)}")

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,  # 10 minute timeout per chapter
    )

    if result.returncode != 0:
        print(f"  Aeneas stderr: {result.stderr}")
        raise RuntimeError(f"Aeneas failed with code {result.returncode}")

    # Parse output JSON
    with open(output_path, encoding="utf-8") as f:
        return json.load(f)


def parse_aeneas_output(aeneas_data: dict, chapter_id: int) -> ChapterAlignment:
    """Parse Aeneas JSON output into our alignment format."""
    sentences = get_chapter_sentences(chapter_id)
    sentence_ids = [s.sentence_id for s in sentences]

    fragments = aeneas_data.get("fragments", [])

    alignments: list[AlignmentData] = []
    for i, fragment in enumerate(fragments):
        if i >= len(sentence_ids):
            print(
                f"  Warning: More fragments ({len(fragments)}) than sentences ({len(sentence_ids)})"
            )
            break

        alignments.append(
            AlignmentData(
                sentence_id=sentence_ids[i],
                start=float(fragment["begin"]),
                end=float(fragment["end"]),
            )
        )

    if len(alignments) < len(sentence_ids):
        print(
            f"  Warning: Fewer alignments ({len(alignments)}) than sentences ({len(sentence_ids)})"
        )

    return ChapterAlignment(chapter_id=chapter_id, sentences=alignments)


def align_chapter(chapter_id: int, force: bool = False) -> ChapterAlignment:
    """Align a single chapter's audio with its sentences.

    Args:
        chapter_id: The chapter to align
        force: If True, realign even if alignment exists

    Returns:
        ChapterAlignment with sentence timestamps
    """
    settings = get_settings()
    audio_dir = settings.get_audio_path()
    data_dir = settings.get_data_path()

    audio_path = audio_dir / f"chapter_{chapter_id}.mp3"
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # Check if already aligned (unless force)
    sentences = get_chapter_sentences(chapter_id)
    if not force and sentences and sentences[0].start_time is not None:
        print(f"  Chapter {chapter_id} already aligned, skipping")
        alignments = [
            AlignmentData(sentence_id=s.sentence_id, start=s.start_time, end=s.end_time)
            for s in sentences
            if s.start_time is not None
        ]
        return ChapterAlignment(chapter_id=chapter_id, sentences=alignments)

    # Create temporary directory for Aeneas files
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Create sentence text file
        text_path = create_sentence_file(chapter_id, temp_path)
        output_path = temp_path / f"alignment_{chapter_id}.json"

        # Run Aeneas
        print(f"  Aligning {len(sentences)} sentences...")
        aeneas_data = run_aeneas_alignment(audio_path, text_path, output_path)

        # Parse results
        alignment = parse_aeneas_output(aeneas_data, chapter_id)

    # Save alignment to JSON for reference
    alignment_dir = data_dir / "alignments"
    alignment_dir.mkdir(parents=True, exist_ok=True)
    alignment_path = alignment_dir / f"chapter_{chapter_id}_alignment.json"
    with open(alignment_path, "w", encoding="utf-8") as f:
        json.dump(alignment.model_dump(), f, indent=2)
    print(f"  Saved alignment to {alignment_path}")

    # Update database with alignment times
    update_alignments_batch([(a.sentence_id, a.start, a.end) for a in alignment.sentences])
    print(f"  Updated {len(alignment.sentences)} sentence alignments in database")

    return alignment


def align_all_chapters(force: bool = False, start_chapter: int = 1) -> None:
    """Align all chapters.

    Args:
        force: If True, realign all chapters
        start_chapter: Chapter to start from
    """
    chapters = get_all_chapters()

    print(f"Aligning {len(chapters)} chapters...")
    print()

    for chapter in chapters:
        if chapter.chapter_id < start_chapter:
            continue

        print(f"Chapter {chapter.chapter_id}: {chapter.title}")

        try:
            alignment = align_chapter(chapter.chapter_id, force=force)
            print(f"  Aligned {len(alignment.sentences)} sentences")
        except FileNotFoundError as e:
            print(f"  SKIPPED: {e}")
        except Exception as e:
            print(f"  ERROR: {e}")
            raise

        print()

    print("Alignment complete!")


def validate_alignments() -> None:
    """Validate that all sentences have alignment data."""
    chapters = get_all_chapters()
    issues = []

    for chapter in chapters:
        sentences = get_chapter_sentences(chapter.chapter_id)
        for sentence in sentences:
            if sentence.start_time is None or sentence.end_time is None:
                issues.append(
                    f"Chapter {chapter.chapter_id}, sentence {sentence.sentence_id}: missing alignment"
                )
            elif sentence.start_time >= sentence.end_time:
                issues.append(
                    f"Chapter {chapter.chapter_id}, sentence {sentence.sentence_id}: invalid times"
                )

    if issues:
        print(f"Found {len(issues)} alignment issues:")
        for issue in issues[:10]:
            print(f"  - {issue}")
        if len(issues) > 10:
            print(f"  ... and {len(issues) - 10} more")
    else:
        print("All alignments valid!")


def main() -> None:
    """Run alignment as standalone script."""
    import argparse

    parser = argparse.ArgumentParser(description="Align audiobook audio with text using Aeneas")
    parser.add_argument("--force", action="store_true", help="Realign all chapters")
    parser.add_argument("--start", type=int, default=1, help="Chapter to start from")
    parser.add_argument("--chapter", type=int, help="Align single chapter only")
    parser.add_argument("--validate", action="store_true", help="Validate existing alignments")
    args = parser.parse_args()

    if args.validate:
        validate_alignments()
    elif args.chapter:
        print(f"Aligning chapter {args.chapter}...")
        align_chapter(args.chapter, force=args.force)
    else:
        align_all_chapters(force=args.force, start_chapter=args.start)


if __name__ == "__main__":
    main()
