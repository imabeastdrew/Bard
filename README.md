# Bard

Interactive narration system

## Requirements

- Python 3.11+
- Node.js 18+
- FFmpeg and espeak

## Setup

```bash
# System dependencies (macOS)
brew install ffmpeg espeak

# Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pip install numpy setuptools wheel

# Install aeneas for audio-text alignment
# Note: Aeneas (last updated 2017) is incompatible with Python 3.12+ and NumPy 2.0+
# The flags below provide espeak library paths and use the venv's numpy
LDFLAGS="-L$(brew --prefix espeak)/lib" \
CFLAGS="-I$(brew --prefix espeak)/include" \
pip install --no-build-isolation aeneas

# NLTK data
python -c "import nltk; nltk.download('punkt_tab')"

# Frontend
cd frontend && npm install
```

## Configuration

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
OPENAI_API_KEY=...
```

## Running

### 1. Preprocessing (one-time)

```bash
# Prepare text only (no API keys needed)
python -m bard.preprocessing.text_prep

# Full pipeline with audio generation (requires ElevenLabs)
bard-preprocess
```

### 2. Start Backend

```bash
bard-serve
```

### 3. Start Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173

## API

| Endpoint | Description |
|----------|-------------|
| `GET /chapters` | List chapters |
| `GET /chapters/{id}/audio` | Stream audio |
| `GET /chapters/{id}/alignment` | Get timestamps |
| `POST /ask` | Ask a question |
