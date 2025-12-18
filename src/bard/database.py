"""SQLite database management for Bard."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from bard.config import get_settings
from bard.models import Chapter, ChapterInfo, Sentence, SentenceAlignment

SCHEMA = """
-- Chapters: one audio file per chapter
CREATE TABLE IF NOT EXISTS chapters (
    chapter_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    audio_path TEXT,
    duration_seconds REAL
);

-- Sentences: alignment data with timestamps
CREATE TABLE IF NOT EXISTS sentences (
    sentence_id INTEGER PRIMARY KEY,
    chapter_id INTEGER NOT NULL REFERENCES chapters(chapter_id),
    sequence INTEGER NOT NULL,
    text TEXT NOT NULL,
    start_time REAL,
    end_time REAL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sentences_chapter ON sentences(chapter_id, sequence);
CREATE INDEX IF NOT EXISTS idx_sentences_time ON sentences(chapter_id, start_time);
CREATE INDEX IF NOT EXISTS idx_sentences_id ON sentences(sentence_id);
"""


def get_db_path() -> Path:
    """Get the database path, creating parent directories if needed."""
    settings = get_settings()
    db_path = settings.get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """Get a database connection with row factory."""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Initialize the database schema."""
    with get_connection() as conn:
        conn.executescript(SCHEMA)
        conn.commit()


def reset_db() -> None:
    """Drop all tables and reinitialize."""
    with get_connection() as conn:
        conn.execute("DROP TABLE IF EXISTS sentences")
        conn.execute("DROP TABLE IF EXISTS chapters")
        conn.executescript(SCHEMA)
        conn.commit()


# Chapter operations


def insert_chapter(chapter: Chapter) -> None:
    """Insert a chapter into the database."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO chapters (chapter_id, title, audio_path, duration_seconds)
            VALUES (?, ?, ?, ?)
            """,
            (chapter.chapter_id, chapter.title, chapter.audio_path, chapter.duration_seconds),
        )
        conn.commit()


def get_chapter(chapter_id: int) -> Chapter | None:
    """Get a chapter by ID."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM chapters WHERE chapter_id = ?", (chapter_id,)
        ).fetchone()
        if row:
            return Chapter(**dict(row))
        return None


def get_all_chapters() -> list[ChapterInfo]:
    """Get all chapters with sentence counts."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT c.chapter_id, c.title, c.duration_seconds, COUNT(s.sentence_id) as sentence_count
            FROM chapters c
            LEFT JOIN sentences s ON c.chapter_id = s.chapter_id
            GROUP BY c.chapter_id
            ORDER BY c.chapter_id
            """
        ).fetchall()
        return [ChapterInfo(**dict(row)) for row in rows]


def update_chapter_audio(chapter_id: int, audio_path: str, duration_seconds: float) -> None:
    """Update chapter audio path and duration."""
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE chapters SET audio_path = ?, duration_seconds = ?
            WHERE chapter_id = ?
            """,
            (audio_path, duration_seconds, chapter_id),
        )
        conn.commit()


# Sentence operations


def insert_sentence(sentence: Sentence) -> None:
    """Insert a sentence into the database."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO sentences 
            (sentence_id, chapter_id, sequence, text, start_time, end_time)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                sentence.sentence_id,
                sentence.chapter_id,
                sentence.sequence,
                sentence.text,
                sentence.start_time,
                sentence.end_time,
            ),
        )
        conn.commit()


def insert_sentences_batch(sentences: list[Sentence]) -> None:
    """Insert multiple sentences in a single transaction."""
    with get_connection() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO sentences 
            (sentence_id, chapter_id, sequence, text, start_time, end_time)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (s.sentence_id, s.chapter_id, s.sequence, s.text, s.start_time, s.end_time)
                for s in sentences
            ],
        )
        conn.commit()


def get_sentence(sentence_id: int) -> Sentence | None:
    """Get a sentence by ID."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM sentences WHERE sentence_id = ?", (sentence_id,)
        ).fetchone()
        if row:
            return Sentence(**dict(row))
        return None


def get_chapter_sentences(chapter_id: int) -> list[Sentence]:
    """Get all sentences for a chapter, ordered by sequence."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM sentences 
            WHERE chapter_id = ? 
            ORDER BY sequence
            """,
            (chapter_id,),
        ).fetchall()
        return [Sentence(**dict(row)) for row in rows]


def get_chapter_alignment(chapter_id: int) -> list[SentenceAlignment]:
    """Get alignment data for a chapter."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT sentence_id, sequence, text, start_time, end_time
            FROM sentences 
            WHERE chapter_id = ? AND start_time IS NOT NULL
            ORDER BY sequence
            """,
            (chapter_id,),
        ).fetchall()
        return [SentenceAlignment(**dict(row)) for row in rows]


def update_sentence_alignment(sentence_id: int, start_time: float, end_time: float) -> None:
    """Update alignment times for a sentence."""
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE sentences SET start_time = ?, end_time = ?
            WHERE sentence_id = ?
            """,
            (start_time, end_time, sentence_id),
        )
        conn.commit()


def update_alignments_batch(alignments: list[tuple[int, float, float]]) -> None:
    """Update multiple sentence alignments in a single transaction.

    Args:
        alignments: List of (sentence_id, start_time, end_time) tuples
    """
    with get_connection() as conn:
        conn.executemany(
            """
            UPDATE sentences SET start_time = ?, end_time = ?
            WHERE sentence_id = ?
            """,
            [(start, end, sid) for sid, start, end in alignments],
        )
        conn.commit()


# Context retrieval for RAG


def find_sentence_at_time(chapter_id: int, audio_time: float) -> Sentence | None:
    """Find the sentence being spoken at a given time in chapter audio.

    Returns the sentence where start_time <= audio_time <= end_time.
    If audio_time is before the first sentence or in a gap, returns the next sentence.
    """
    with get_connection() as conn:
        # First try exact match
        row = conn.execute(
            """
            SELECT * FROM sentences 
            WHERE chapter_id = ? AND start_time <= ? AND end_time >= ?
            ORDER BY start_time DESC
            LIMIT 1
            """,
            (chapter_id, audio_time, audio_time),
        ).fetchone()

        if row:
            return Sentence(**dict(row))

        # If no exact match, find the most recent sentence before this time
        row = conn.execute(
            """
            SELECT * FROM sentences 
            WHERE chapter_id = ? AND start_time <= ?
            ORDER BY start_time DESC
            LIMIT 1
            """,
            (chapter_id, audio_time),
        ).fetchone()

        if row:
            return Sentence(**dict(row))

        # If still no match, return the first sentence of the chapter
        row = conn.execute(
            """
            SELECT * FROM sentences 
            WHERE chapter_id = ?
            ORDER BY sequence
            LIMIT 1
            """,
            (chapter_id,),
        ).fetchone()

        if row:
            return Sentence(**dict(row))

        return None


def get_context_sentences(up_to_sentence_id: int) -> list[Sentence]:
    """Get all sentences up to and including the given sentence ID.

    This returns sentences in narrative order (by chapter, then sequence).
    """
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM sentences 
            WHERE sentence_id <= ?
            ORDER BY chapter_id, sequence
            """,
            (up_to_sentence_id,),
        ).fetchall()
        return [Sentence(**dict(row)) for row in rows]


def get_total_sentence_count() -> int:
    """Get total number of sentences in the database."""
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) as count FROM sentences").fetchone()
        return row["count"] if row else 0

