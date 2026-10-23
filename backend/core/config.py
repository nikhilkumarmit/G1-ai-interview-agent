"""
Application configuration — loaded from .env at the project root.
All secrets live in environment variables; defaults are safe for local dev.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend folder or project root
_backend_env = Path(__file__).resolve().parents[1] / ".env"
_root_env = Path(__file__).resolve().parents[2] / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env, override=True)
if _root_env.exists():
    load_dotenv(_root_env, override=False)



class Settings:
    # ── Server ──────────────────────────────────────────────────
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # ── Groq API ────────────────────────────────────────────────
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # ── Models (all free-tier on Groq) ──────────────────────────
    STT_MODEL: str = os.getenv("STT_MODEL", "whisper-large-v3-turbo")
    TTS_MODEL: str = os.getenv("TTS_MODEL", "playai-tts")
    TTS_VOICE: str = os.getenv("TTS_VOICE", "Fritz-PlayAI")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

    # ── ChromaDB (Cloud & Local) ────────────────────────────────
    CHROMA_USE_CLOUD: bool = os.getenv("CHROMA_USE_CLOUD", "false").lower() in ("true", "1", "yes")
    CHROMA_API_KEY: str = os.getenv("CHROMA_API_KEY", "")
    CHROMA_TENANT: str = os.getenv("CHROMA_TENANT", "")
    CHROMA_DATABASE: str = os.getenv("CHROMA_DATABASE", "")
    CHROMA_CLOUD_HOST: str = os.getenv("CHROMA_CLOUD_HOST", "api.trychroma.com")
    CHROMA_HOST: str = os.getenv("CHROMA_HOST", "")
    CHROMA_PORT: int = int(os.getenv("CHROMA_PORT", "8000"))
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")
    CHROMA_COLLECTION: str = os.getenv("CHROMA_COLLECTION", "interview_chunks")


    # ── Interview limits ────────────────────────────────────────
    QUESTION_BUDGET: int = int(os.getenv("QUESTION_BUDGET", "12"))
    TIME_LIMIT_SECONDS: int = int(os.getenv("TIME_LIMIT_SECONDS", "1800"))
    MAX_FOLLOWUPS_PER_QUESTION: int = int(os.getenv("MAX_FOLLOWUPS", "2"))

    # ── Persistence ─────────────────────────────────────────────
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")
    SESSION_FILE: str = os.getenv("SESSION_FILE", "./data/session.json")
    TRANSCRIPT_FILE: str = os.getenv("TRANSCRIPT_FILE", "./data/transcript.json")

    # ── Audio ───────────────────────────────────────────────────
    SAMPLE_RATE: int = int(os.getenv("SAMPLE_RATE", "16000"))

    # ── VAD Settings ────────────────────────────────────────────
    # VAD confidence threshold — higher = less sensitive = fewer false cuts.
    # Set to 0.7 so a thinking pause (silence < 1.5 s) does NOT cut the candidate off.
    VAD_THRESHOLD: float = float(os.getenv("VAD_THRESHOLD", "0.7"))
    # Minimum speech duration (ms) before VAD fires — avoids cutting on short pauses.
    VAD_MIN_SPEECH_MS: int = int(os.getenv("VAD_MIN_SPEECH_MS", "500"))
    # Silence duration (ms) after which VAD considers speech ended.
    VAD_SILENCE_MS: int = int(os.getenv("VAD_SILENCE_MS", "1500"))


settings = Settings()
