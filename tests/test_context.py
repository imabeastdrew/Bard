"""Tests for context assembly service."""

import pytest

from bard.database import init_db, insert_chapter, insert_sentences_batch
from bard.models import Chapter, Sentence
from bard.services.context import (
    build_context,
    get_context_stats,
    resolve_current_sentence,
    truncate_to_tokens,
)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Set up a test database with sample data."""
    # Point database to temp directory
    from bard import config
    from bard import database as db_module
    from bard.services import context as context_module

    test_db = tmp_path / "test.db"

    class TestSettings:
        def get_db_path(self):
            return test_db

        max_context_tokens = 10000

    # Clear any cached settings before monkeypatching
    if hasattr(config.get_settings, "cache_clear"):
        config.get_settings.cache_clear()

    # Monkeypatch the db_path function directly
    monkeypatch.setattr(db_module, "get_db_path", lambda: test_db)
    monkeypatch.setattr(context_module, "get_settings", lambda: TestSettings())

    # Initialize and populate
    init_db()

    # Insert test chapters
    insert_chapter(Chapter(chapter_id=1, title="Chapter 1", audio_path=None, duration_seconds=60.0))
    insert_chapter(Chapter(chapter_id=2, title="Chapter 2", audio_path=None, duration_seconds=90.0))

    # Insert test sentences
    sentences = [
        Sentence(
            sentence_id=1,
            chapter_id=1,
            sequence=0,
            text="First sentence.",
            start_time=0.0,
            end_time=2.0,
        ),
        Sentence(
            sentence_id=2,
            chapter_id=1,
            sequence=1,
            text="Second sentence.",
            start_time=2.0,
            end_time=4.0,
        ),
        Sentence(
            sentence_id=3,
            chapter_id=1,
            sequence=2,
            text="Third sentence.",
            start_time=4.0,
            end_time=6.0,
        ),
        Sentence(
            sentence_id=4,
            chapter_id=2,
            sequence=0,
            text="Fourth sentence.",
            start_time=0.0,
            end_time=3.0,
        ),
        Sentence(
            sentence_id=5,
            chapter_id=2,
            sequence=1,
            text="Fifth sentence.",
            start_time=3.0,
            end_time=5.0,
        ),
    ]
    insert_sentences_batch(sentences)

    yield


class TestResolveCurrentSentence:
    """Tests for resolve_current_sentence function."""

    def test_exact_time_match(self):
        """Test resolution when time exactly matches a sentence."""
        sentence = resolve_current_sentence(chapter_id=1, audio_time=1.0)
        assert sentence.sentence_id == 1
        assert sentence.text == "First sentence."

    def test_time_at_boundary(self):
        """Test resolution at sentence boundary."""
        sentence = resolve_current_sentence(chapter_id=1, audio_time=2.0)
        # At boundary, should return the sentence that includes that time
        assert sentence.sentence_id in [1, 2]

    def test_time_mid_sentence(self):
        """Test resolution in middle of sentence."""
        sentence = resolve_current_sentence(chapter_id=1, audio_time=3.0)
        assert sentence.sentence_id == 2

    def test_different_chapter(self):
        """Test resolution in second chapter."""
        sentence = resolve_current_sentence(chapter_id=2, audio_time=1.5)
        assert sentence.sentence_id == 4
        assert sentence.chapter_id == 2

    def test_invalid_chapter(self):
        """Test with invalid chapter raises error."""
        with pytest.raises(ValueError):
            resolve_current_sentence(chapter_id=999, audio_time=1.0)


class TestBuildContext:
    """Tests for build_context function."""

    def test_context_includes_current_sentence(self):
        """Test that context includes the current sentence."""
        context = build_context(current_sentence_id=2)
        assert "First sentence." in context
        assert "Second sentence." in context

    def test_context_excludes_future_sentences(self):
        """Test that context excludes future sentences."""
        context = build_context(current_sentence_id=2)
        assert "Third sentence." not in context

    def test_context_includes_all_prior_chapters(self):
        """Test that context from prior chapters is included."""
        context = build_context(current_sentence_id=4)
        # Should include all of chapter 1
        assert "First sentence." in context
        assert "Second sentence." in context
        assert "Third sentence." in context
        # And the current sentence from chapter 2
        assert "Fourth sentence." in context
        # But not future sentences
        assert "Fifth sentence." not in context

    def test_context_contains_chapter_headers(self):
        """Test that context includes chapter markers."""
        context = build_context(current_sentence_id=4)
        assert "Chapter 1" in context
        assert "Chapter 2" in context

    def test_empty_context(self):
        """Test with invalid sentence ID returns empty."""
        # Using sentence_id=0 which doesn't exist
        context = build_context(current_sentence_id=0)
        assert context == ""


class TestGetContextStats:
    """Tests for get_context_stats function."""

    def test_stats_count(self):
        """Test that stats return correct counts."""
        stats = get_context_stats(current_sentence_id=3)
        assert stats["sentence_count"] == 3
        assert stats["chapter_count"] == 1

    def test_stats_multi_chapter(self):
        """Test stats across multiple chapters."""
        stats = get_context_stats(current_sentence_id=5)
        assert stats["sentence_count"] == 5
        assert stats["chapter_count"] == 2

    def test_stats_has_tokens(self):
        """Test that token estimate is present."""
        stats = get_context_stats(current_sentence_id=3)
        assert "estimated_tokens" in stats
        assert stats["estimated_tokens"] > 0


class TestTruncateToTokens:
    """Tests for truncate_to_tokens function."""

    def test_no_truncation_needed(self):
        """Test that short text is not truncated."""
        text = "This is a short text."
        result = truncate_to_tokens(text, max_tokens=100)
        assert result == text

    def test_truncation_preserves_end(self):
        """Test that truncation keeps the end of the text."""
        text = "Start. " * 100 + "End."
        result = truncate_to_tokens(text, max_tokens=10)
        assert "End." in result
