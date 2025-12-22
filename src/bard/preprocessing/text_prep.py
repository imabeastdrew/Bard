"""Text preparation for the Gospel of Luke (World English Bible).

This module:
1. Downloads or loads the WEB Luke text
2. Normalizes quotes, punctuation, dashes
3. Splits into chapters and sentences
4. Assigns globally unique sentence IDs
"""

import json
import re
import urllib.request
from pathlib import Path

import nltk

from bard.config import get_settings
from bard.database import init_db, insert_chapter, insert_sentences_batch
from bard.models import Chapter, ChapterWithSentences, PreparedText, Sentence

# Constants
LUKE_CHAPTERS = 24
MAX_SENTENCE_LENGTH = 300  # Characters

# USFM verse marker pattern
VERSE_PATTERN = re.compile(r"\\v\s+\d+\s*")
CHAPTER_PATTERN = re.compile(r"\\c\s+(\d+)")

# Bible API for WEB Luke text
BIBLE_API_URL = "https://bible-api.com/Luke{}?translation=web"


def download_luke_from_api(output_path: Path) -> str:
    """Download all Luke chapters from bible-api.com."""
    import json as json_module

    all_text = []

    for chapter in range(1, LUKE_CHAPTERS + 1):
        url = BIBLE_API_URL.format(chapter)
        print(f"  Downloading chapter {chapter}...")
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                data = json_module.loads(response.read().decode("utf-8"))

            # Build USFM-style text from verses
            chapter_text = [f"\\c {chapter}"]
            for verse in data.get("verses", []):
                verse_num = verse.get("verse", "")
                verse_text = verse.get("text", "").strip()
                chapter_text.append(f"\\v {verse_num} {verse_text}")

            all_text.append("\n".join(chapter_text))
        except Exception as e:
            print(f"    Failed to download chapter {chapter}: {e}")
            raise

    content = "\n\n".join(all_text)
    output_path.write_text(content, encoding="utf-8")
    print(f"Saved {LUKE_CHAPTERS} chapters to {output_path}")
    return content


def download_luke_text(output_path: Path) -> str:
    """Download Luke text from bible-api.com."""
    print("Downloading Gospel of Luke from bible-api.com...")
    try:
        return download_luke_from_api(output_path)
    except Exception as e:
        print(f"Download failed: {e}")
        print("Using embedded sample text...")
        return get_embedded_luke_sample()


def load_luke_text(data_dir: Path) -> str:
    """Load Luke text, downloading if necessary."""
    source_path = data_dir / "luke_source.txt"

    if source_path.exists():
        print(f"Loading existing source from {source_path}")
        return source_path.read_text(encoding="utf-8")

    # Download from available sources
    data_dir.mkdir(parents=True, exist_ok=True)
    return download_luke_text(source_path)


def get_embedded_luke_sample() -> str:
    """Return embedded Luke chapter 1 sample for testing."""
    return """\\c 1
\\v 1 Since many have undertaken to set in order a narrative concerning those matters which have been fulfilled among us,
\\v 2 even as those who from the beginning were eyewitnesses and servants of the word delivered them to us,
\\v 3 it seemed good to me also, having traced the course of all things accurately from the first, to write to you in order, most excellent Theophilus;
\\v 4 that you might know the certainty concerning the things in which you were instructed.
\\v 5 There was in the days of Herod, the king of Judea, a certain priest named Zacharias, of the priestly division of Abijah. He had a wife of the daughters of Aaron, and her name was Elizabeth.
\\v 6 They were both righteous before God, walking blamelessly in all the commandments and ordinances of the Lord.
\\v 7 But they had no child, because Elizabeth was barren, and they both were well advanced in years.
\\v 8 Now while he executed the priest's office before God in the order of his division,
\\v 9 according to the custom of the priest's office, his lot was to enter into the temple of the Lord and burn incense.
\\v 10 The whole multitude of the people were praying outside at the hour of incense.
\\v 11 An angel of the Lord appeared to him, standing on the right side of the altar of incense.
\\v 12 Zacharias was troubled when he saw him, and fear fell upon him.
\\v 13 But the angel said to him, "Don't be afraid, Zacharias, because your request has been heard, and your wife, Elizabeth, will bear you a son, and you shall call his name John.
\\v 14 You will have joy and gladness; and many will rejoice at his birth.
\\v 15 For he will be great in the sight of the Lord, and he will drink no wine nor strong drink. He will be filled with the Holy Spirit, even from his mother's womb.
\\v 16 He will turn many of the children of Israel to the Lord, their God.
\\v 17 He will go before him in the spirit and power of Elijah, 'to turn the hearts of the fathers to the children,' and the disobedient to the wisdom of the just; to make ready a people prepared for the Lord."
\\v 18 Zacharias said to the angel, "How can I be sure of this? For I am an old man, and my wife is well advanced in years."
\\v 19 The angel answered him, "I am Gabriel, who stands in the presence of God. I was sent to speak to you, and to bring you this good news.
\\v 20 Behold, you will be silent and not able to speak, until the day that these things will happen, because you didn't believe my words, which will be fulfilled in their proper time."
"""


def normalize_text(text: str) -> str:
    """Normalize text for consistent TTS output.

    - Convert curly quotes to straight quotes
    - Standardize dashes
    - Clean up whitespace
    - Remove USFM formatting markers
    """
    # Remove USFM markers (except chapter/verse for parsing)
    text = re.sub(r"\\(id|ide|h|toc\d?|mt\d?|ms\d?|s\d?|r|p|q\d?|m|nb|b)\s*[^\n]*\n?", "", text)
    text = re.sub(r"\\(f|x|fe)\s*\+?\s*.*?\\(f|x|fe)\*", "", text)  # Remove footnotes
    text = re.sub(r"\\(wj|add|nd|pn|qt|sig)\s*\*?", "", text)  # Remove character markers
    text = re.sub(r"\\(wj|add|nd|pn|qt|sig)\*", "", text)

    # Curly quotes to straight
    text = text.replace(""", '"').replace(""", '"')
    text = text.replace("'", "'").replace("'", "'")

    # Standardize dashes
    text = text.replace("—", " -- ")
    text = text.replace("–", " - ")

    # Clean up whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)

    return text.strip()


def parse_chapters(text: str) -> list[tuple[int, str]]:
    """Parse text into chapters.

    Handles both USFM format and plain text with chapter markers.
    Returns list of (chapter_number, chapter_text) tuples.
    """
    chapters = []
    current_chapter = 0
    current_text = []

    # Detect if this is USFM or plain text
    is_usfm = "\\c " in text or "\\v " in text

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Check for chapter markers
        chapter_match = CHAPTER_PATTERN.match(line)
        if chapter_match:
            # Save previous chapter
            if current_chapter > 0 and current_text:
                chapter_content = " ".join(current_text).strip()
                chapters.append((current_chapter, chapter_content))
            current_chapter = int(chapter_match.group(1))
            current_text = []
            continue

        # Plain text format: "Chapter X" header
        if line.lower().startswith("chapter ") and line.split()[1].isdigit():
            if current_chapter > 0 and current_text:
                chapter_content = " ".join(current_text).strip()
                chapters.append((current_chapter, chapter_content))
            current_chapter = int(line.split()[1])
            current_text = []
            continue

        # Plain text: "Luke X:Y" verse format
        luke_match = re.match(r"^Luke\s+(\d+):(\d+)\s+(.*)", line)
        if luke_match:
            chapter_num = int(luke_match.group(1))
            if chapter_num != current_chapter:
                if current_chapter > 0 and current_text:
                    chapter_content = " ".join(current_text).strip()
                    chapters.append((current_chapter, chapter_content))
                current_chapter = chapter_num
                current_text = []
            verse_text = luke_match.group(3).strip()
            if verse_text:
                current_text.append(verse_text)
            continue

        if current_chapter > 0:
            # Remove USFM verse markers if present
            if is_usfm:
                verse_text = VERSE_PATTERN.sub("", line).strip()
            else:
                verse_text = line
            if verse_text:
                current_text.append(verse_text)

    # Don't forget the last chapter
    if current_chapter > 0 and current_text:
        chapter_content = " ".join(current_text).strip()
        chapters.append((current_chapter, chapter_content))

    return chapters


def split_sentences(text: str) -> list[str]:
    """Split text into sentences using NLTK.

    Handles:
    - Standard sentence boundaries
    - Abbreviations (Dr., Mr., etc.)
    - Quoted speech
    """
    # Ensure NLTK punkt tokenizer is available
    try:
        nltk.data.find("tokenizers/punkt_tab")
    except LookupError:
        print("Downloading NLTK punkt tokenizer...")
        nltk.download("punkt_tab", quiet=True)

    sentences = nltk.sent_tokenize(text)

    # Post-process: split overly long sentences at clause boundaries
    result = []
    for sent in sentences:
        if len(sent) <= MAX_SENTENCE_LENGTH:
            result.append(sent.strip())
        else:
            # Split at semicolons or clause boundaries
            result.extend(split_long_sentence(sent))

    return [s for s in result if s.strip()]


def split_long_sentence(sentence: str) -> list[str]:
    """Split a long sentence at natural clause boundaries."""
    # Try splitting at semicolons first
    if ";" in sentence:
        parts = sentence.split(";")
        result = []
        for i, part in enumerate(parts):
            part = part.strip()
            if part:
                if i < len(parts) - 1:
                    part += ";"
                result.append(part)
        return result

    # Try splitting at " -- " (em-dash representing pause)
    if " -- " in sentence:
        parts = sentence.split(" -- ")
        result = []
        for i, part in enumerate(parts):
            part = part.strip()
            if part:
                if i < len(parts) - 1:
                    part += " --"
                result.append(part)
        return result

    # Try splitting at ", and " or ", but " or ", for "
    for conjunction in [", and ", ", but ", ", for ", ", so ", ", yet "]:
        if conjunction in sentence:
            idx = sentence.find(conjunction)
            first = sentence[: idx + 1].strip()
            second = sentence[idx + 2 :].strip()
            if first and second:
                return [first, second.capitalize()]

    # If still too long, just return as-is (rare edge case)
    return [sentence]


def prepare_luke_text() -> PreparedText:
    """Prepare the Gospel of Luke text for TTS and alignment.

    Returns a PreparedText object with all chapters and sentences.
    """
    settings = get_settings()
    data_dir = settings.get_data_path()

    # Load and normalize text
    print("Loading Luke text...")
    raw_text = load_luke_text(data_dir)
    normalized = normalize_text(raw_text)

    # Parse into chapters
    print("Parsing chapters...")
    chapter_texts = parse_chapters(normalized)

    if len(chapter_texts) != LUKE_CHAPTERS:
        print(f"Warning: Expected {LUKE_CHAPTERS} chapters, found {len(chapter_texts)}")

    # Build chapter and sentence objects
    chapters: list[ChapterWithSentences] = []
    sentence_id = 1  # Global sentence counter

    for chapter_num, chapter_text in chapter_texts:
        print(f"Processing chapter {chapter_num}...")

        # Split into sentences
        sentence_texts = split_sentences(chapter_text)

        # Create sentence objects
        sentences: list[Sentence] = []
        for seq, text in enumerate(sentence_texts):
            sentences.append(
                Sentence(
                    sentence_id=sentence_id,
                    chapter_id=chapter_num,
                    sequence=seq,
                    text=text,
                    start_time=None,
                    end_time=None,
                )
            )
            sentence_id += 1

        # Create chapter object
        chapter = ChapterWithSentences(
            chapter_id=chapter_num,
            title=f"Luke {chapter_num}",
            audio_path=None,
            duration_seconds=None,
            sentences=sentences,
        )
        chapters.append(chapter)

    prepared = PreparedText(chapters=chapters, total_sentences=sentence_id - 1)

    # Save to JSON
    output_path = data_dir / "luke_prepared.json"
    print(f"Saving prepared text to {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(prepared.model_dump(), f, indent=2, ensure_ascii=False)

    print(f"Prepared {len(chapters)} chapters with {prepared.total_sentences} total sentences")
    return prepared


def load_prepared_text() -> PreparedText | None:
    """Load previously prepared text from JSON."""
    settings = get_settings()
    data_dir = settings.get_data_path()
    prepared_path = data_dir / "luke_prepared.json"

    if not prepared_path.exists():
        return None

    with open(prepared_path, encoding="utf-8") as f:
        data = json.load(f)
    return PreparedText(**data)


def ingest_to_database(prepared: PreparedText) -> None:
    """Insert prepared text data into the database."""
    print("Initializing database...")
    init_db()

    for chapter in prepared.chapters:
        # Insert chapter
        insert_chapter(
            Chapter(
                chapter_id=chapter.chapter_id,
                title=chapter.title,
                audio_path=chapter.audio_path,
                duration_seconds=chapter.duration_seconds,
            )
        )

        # Insert sentences in batch
        insert_sentences_batch(chapter.sentences)
        print(f"  Inserted chapter {chapter.chapter_id} with {len(chapter.sentences)} sentences")

    print(f"Database populated with {prepared.total_sentences} sentences")


def main() -> None:
    """Run text preparation as standalone script."""
    prepared = prepare_luke_text()
    ingest_to_database(prepared)
    print("Text preparation complete!")


if __name__ == "__main__":
    main()
