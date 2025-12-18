"""Tests for database operations."""

import pytest

from bard.database import (
    find_sentence_at_time,
    get_all_chapters,
    get_chapter,
    get_chapter_alignment,
    get_chapter_sentences,
    get_context_sentences,
    init_db,
    insert_chapter,
    insert_sentences_batch,
    update_chapter_audio,
)
from bard.models import Chapter, Sentence


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Set up a test database."""
    from bard import config
    from bard import database as db_module
    
    test_db = tmp_path / "test.db"
    
    class TestSettings:
        def get_db_path(self):
            return test_db
    
    # Clear any cached settings before monkeypatching
    if hasattr(config.get_settings, "cache_clear"):
        config.get_settings.cache_clear()
    
    # Monkeypatch the db_path function directly
    monkeypatch.setattr(db_module, "get_db_path", lambda: test_db)
    
    init_db()
    yield


class TestChapterOperations:
    """Tests for chapter database operations."""
    
    def test_insert_and_get_chapter(self):
        """Test inserting and retrieving a chapter."""
        chapter = Chapter(
            chapter_id=1,
            title="Test Chapter",
            audio_path="audio/test.mp3",
            duration_seconds=120.5
        )
        insert_chapter(chapter)
        
        retrieved = get_chapter(1)
        assert retrieved is not None
        assert retrieved.chapter_id == 1
        assert retrieved.title == "Test Chapter"
        assert retrieved.audio_path == "audio/test.mp3"
        assert retrieved.duration_seconds == 120.5
    
    def test_get_nonexistent_chapter(self):
        """Test getting a chapter that doesn't exist."""
        retrieved = get_chapter(999)
        assert retrieved is None
    
    def test_get_all_chapters(self):
        """Test getting all chapters."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        insert_chapter(Chapter(chapter_id=2, title="Chapter 2"))
        
        chapters = get_all_chapters()
        assert len(chapters) == 2
        assert chapters[0].chapter_id == 1
        assert chapters[1].chapter_id == 2
    
    def test_update_chapter_audio(self):
        """Test updating chapter audio metadata."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        update_chapter_audio(1, "audio/chapter_1.mp3", 180.0)
        
        chapter = get_chapter(1)
        assert chapter.audio_path == "audio/chapter_1.mp3"
        assert chapter.duration_seconds == 180.0


class TestSentenceOperations:
    """Tests for sentence database operations."""
    
    def test_insert_and_get_sentences(self):
        """Test inserting and retrieving sentences."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        
        sentences = [
            Sentence(sentence_id=1, chapter_id=1, sequence=0, text="First.", start_time=0.0, end_time=1.0),
            Sentence(sentence_id=2, chapter_id=1, sequence=1, text="Second.", start_time=1.0, end_time=2.0),
        ]
        insert_sentences_batch(sentences)
        
        retrieved = get_chapter_sentences(1)
        assert len(retrieved) == 2
        assert retrieved[0].text == "First."
        assert retrieved[1].text == "Second."
    
    def test_sentences_ordered_by_sequence(self):
        """Test that sentences are returned in sequence order."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        
        # Insert out of order
        sentences = [
            Sentence(sentence_id=2, chapter_id=1, sequence=1, text="Second."),
            Sentence(sentence_id=1, chapter_id=1, sequence=0, text="First."),
        ]
        insert_sentences_batch(sentences)
        
        retrieved = get_chapter_sentences(1)
        assert retrieved[0].sequence == 0
        assert retrieved[1].sequence == 1


class TestAlignmentQueries:
    """Tests for alignment-related queries."""
    
    def test_find_sentence_at_time_exact(self):
        """Test finding sentence at exact time."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        sentences = [
            Sentence(sentence_id=1, chapter_id=1, sequence=0, text="First.", start_time=0.0, end_time=2.0),
            Sentence(sentence_id=2, chapter_id=1, sequence=1, text="Second.", start_time=2.0, end_time=4.0),
        ]
        insert_sentences_batch(sentences)
        
        sentence = find_sentence_at_time(1, 1.0)
        assert sentence is not None
        assert sentence.sentence_id == 1
    
    def test_find_sentence_at_time_boundary(self):
        """Test finding sentence at boundary."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        sentences = [
            Sentence(sentence_id=1, chapter_id=1, sequence=0, text="First.", start_time=0.0, end_time=2.0),
            Sentence(sentence_id=2, chapter_id=1, sequence=1, text="Second.", start_time=2.0, end_time=4.0),
        ]
        insert_sentences_batch(sentences)
        
        sentence = find_sentence_at_time(1, 2.0)
        assert sentence is not None
        # Could be either sentence at boundary
        assert sentence.sentence_id in [1, 2]
    
    def test_get_context_sentences(self):
        """Test getting context sentences up to a point."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        insert_chapter(Chapter(chapter_id=2, title="Chapter 2"))
        
        sentences = [
            Sentence(sentence_id=1, chapter_id=1, sequence=0, text="One."),
            Sentence(sentence_id=2, chapter_id=1, sequence=1, text="Two."),
            Sentence(sentence_id=3, chapter_id=2, sequence=0, text="Three."),
            Sentence(sentence_id=4, chapter_id=2, sequence=1, text="Four."),
        ]
        insert_sentences_batch(sentences)
        
        context = get_context_sentences(3)
        assert len(context) == 3
        assert context[0].sentence_id == 1
        assert context[2].sentence_id == 3
    
    def test_get_chapter_alignment(self):
        """Test getting alignment data for a chapter."""
        insert_chapter(Chapter(chapter_id=1, title="Chapter 1"))
        sentences = [
            Sentence(sentence_id=1, chapter_id=1, sequence=0, text="First.", start_time=0.0, end_time=2.0),
            Sentence(sentence_id=2, chapter_id=1, sequence=1, text="Second.", start_time=2.0, end_time=4.0),
        ]
        insert_sentences_batch(sentences)
        
        alignment = get_chapter_alignment(1)
        assert len(alignment) == 2
        assert alignment[0].start_time == 0.0
        assert alignment[0].end_time == 2.0

