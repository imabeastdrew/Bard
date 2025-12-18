"""Configuration management for Bard."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # API Keys
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    openai_api_key: str = ""

    # Paths (relative to project root)
    data_dir: Path = Path("data")
    audio_dir: Path = Path("data/audio")
    db_path: Path = Path("data/bard.db")

    # TTS Settings
    tts_model_id: str = "eleven_multilingual_v2"
    tts_output_format: str = "mp3_44100_128"

    # OpenAI Settings
    openai_model: str = "gpt-4o"
    stt_model: str = "gpt-4o-mini-transcribe"
    max_context_tokens: int = 100000

    # Server Settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    @property
    def project_root(self) -> Path:
        """Get the project root directory."""
        return Path(__file__).parent.parent.parent

    def get_data_path(self) -> Path:
        """Get absolute path to data directory."""
        return self.project_root / self.data_dir

    def get_audio_path(self) -> Path:
        """Get absolute path to audio directory."""
        return self.project_root / self.audio_dir

    def get_db_path(self) -> Path:
        """Get absolute path to database."""
        return self.project_root / self.db_path


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

