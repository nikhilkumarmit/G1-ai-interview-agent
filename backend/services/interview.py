"""
Interview state machine — manages stages, question budget, time limits,
transcript persistence, and follow-up logic.

Stages: intro → resume_questions → behavioural → role_questions →
        candidate_questions → closing
"""

import json
import os
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional

from backend.core.config import settings


class Stage(str, Enum):
    INTRO = "intro"
    RESUME_QUESTIONS = "resume_questions"
    BEHAVIOURAL = "behavioural"
    ROLE_QUESTIONS = "role_questions"
    CANDIDATE_QUESTIONS = "candidate_questions"
    CLOSING = "closing"


class InterviewDifficulty(str, Enum):
    BEGINNER = "Beginner"
    INTERMEDIATE = "Intermediate"
    ADVANCED = "Advanced"


# Order of stages for automatic progression
STAGE_ORDER = [
    Stage.INTRO,
    Stage.RESUME_QUESTIONS,
    Stage.BEHAVIOURAL,
    Stage.ROLE_QUESTIONS,
    Stage.CANDIDATE_QUESTIONS,
    Stage.CLOSING,
]

# How many questions (approx) per stage
STAGE_BUDGET = {
    Stage.INTRO: 1,
    Stage.RESUME_QUESTIONS: 4,
    Stage.BEHAVIOURAL: 3,
    Stage.ROLE_QUESTIONS: 2,
    Stage.CANDIDATE_QUESTIONS: 1,
    Stage.CLOSING: 1,
}


@dataclass
class TranscriptEntry:
    speaker: str          # "agent" or "candidate"
    text: str
    timestamp: float
    stt_confidence: float = 1.0   # STT confidence when available
    latency_ms: float = 0.0       # turn latency measurement


@dataclass
class QuestionRecord:
    question: str
    answer: str = ""
    follow_ups: List[Dict[str, str]] = field(default_factory=list)
    stage: str = ""
    scores: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InterviewState:
    stage: str = Stage.INTRO.value
    difficulty: str = InterviewDifficulty.BEGINNER.value
    questions_asked: List[Dict] = field(default_factory=list)
    time_started: float = 0.0
    time_limit: int = settings.TIME_LIMIT_SECONDS
    question_budget: int = settings.QUESTION_BUDGET
    current_question: str = ""
    current_followup_count: int = 0
    transcript: List[Dict] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    candidate_summary: Dict = field(default_factory=dict)
    asked_question_texts: List[str] = field(default_factory=list)  # dedup
    is_finished: bool = False
    session_id: str = ""

    def time_elapsed(self) -> float:
        if self.time_started == 0:
            return 0.0
        return time.time() - self.time_started

    def time_remaining(self) -> float:
        return max(0, self.time_limit - self.time_elapsed())

    def questions_remaining(self) -> int:
        return max(0, self.question_budget - len(self.questions_asked))

    def to_payload(self) -> Dict:
        return {
            "stage": self.stage,
            "difficulty": self.difficulty,
            "question": self.current_question,
            "time_remaining": round(self.time_remaining(), 1),
            "questions_remaining": self.questions_remaining(),
            "is_finished": self.is_finished,
            "session_id": self.session_id,
        }


class InterviewManager:
    """
    Manages the full interview lifecycle. Designed to be used from
    both the REST API and the Pipecat voice pipeline.
    """

    def __init__(self):
        self.state = InterviewState()
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        os.makedirs(settings.DATA_DIR, exist_ok=True)

    # ── Session lifecycle ───────────────────────────────────────

    def start(
        self,
        candidate_summary: Dict = None,
        difficulty: InterviewDifficulty = InterviewDifficulty.BEGINNER,
    ) -> Dict:
        """Start a new interview session."""
        difficulty = InterviewDifficulty(difficulty)
        self.state = InterviewState()
        self.state.time_started = time.time()
        self.state.session_id = f"session_{int(time.time())}"
        self.state.candidate_summary = candidate_summary or {}
        self.state.difficulty = difficulty.value
        self.state.stage = Stage.INTRO.value

        # Safety disclosure — mandated opening line
        opening = (
            "Hello! I'm your AI interview coach. This is a practice session — "
            "I am an artificial intelligence and this conversation is being recorded "
            "for your feedback report only. I will never make any hiring decisions. "
            "Let's begin! "
        )
        intro_questions = {
            InterviewDifficulty.BEGINNER: (
                "Could you briefly introduce yourself and share what interests you about this role?"
            ),
            InterviewDifficulty.INTERMEDIATE: (
                "Could you briefly introduce yourself and highlight the experience most relevant to this role?"
            ),
            InterviewDifficulty.ADVANCED: (
                "Could you briefly introduce yourself and highlight a technically challenging achievement relevant to this role?"
            ),
        }
        opening += intro_questions[difficulty]
        self.state.current_question = opening
        self._add_transcript("agent", opening)
        self._persist()
        return self.state.to_payload()

    def save_answer(self, answer: str, stt_confidence: float = 1.0) -> Dict:
        """Record the candidate's answer and decide: follow-up or next question."""
        self._add_transcript("candidate", answer, stt_confidence=stt_confidence)

        # Record the Q&A pair
        qa = {
            "question": self.state.current_question,
            "answer": answer,
            "stage": self.state.stage,
            "follow_ups": [],
            "followup_count": self.state.current_followup_count,
        }

        # ── Follow-up decision ──────────────────────────────────
        needs_followup = self._needs_followup(answer)
        can_followup = (
            self.state.current_followup_count < settings.MAX_FOLLOWUPS_PER_QUESTION
        )

        if needs_followup and can_followup:
            self.state.current_followup_count += 1
            followup = self._generate_followup_prompt(answer)
            self.state.current_question = followup
            self._add_transcript("agent", followup)
            qa["follow_ups"].append({"question": followup})
        else:
            # Record completed question and reset follow-up counter
            self.state.questions_asked.append(qa)
            self.state.current_followup_count = 0
            self.state.current_question = ""

        self._persist()
        return self.state.to_payload()

    def set_next_question(self, question: str) -> Dict:
        """Set the next question (called by the LLM tool)."""
        if question in self.state.asked_question_texts:
            return self.state.to_payload()  # skip duplicates

        self.state.asked_question_texts.append(question)
        self.state.current_question = question
        self.state.current_followup_count = 0
        self._add_transcript("agent", question)
        self._maybe_advance_stage()
        self._persist()
        return self.state.to_payload()

    def end_interview(self) -> Dict:
        """Wrap up the interview."""
        closing = (
            "Thank you for your time today! That concludes our practice session. "
            "Your detailed feedback report will be generated shortly. "
            "Remember — this was only practice, and no hiring decision has been made."
        )
        self.state.current_question = closing
        self.state.stage = Stage.CLOSING.value
        self.state.is_finished = True
        self._add_transcript("agent", closing)
        self._persist()
        return self.state.to_payload()

    # ── Follow-up heuristics ────────────────────────────────────

    def _needs_followup(self, answer: str) -> bool:
        """Decide if an answer is vague enough to warrant a follow-up."""
        words = answer.strip().split()
        # Very short answers are vague
        if len(words) < 15:
            return True
        # Answers with no specific details (no numbers, no proper nouns)
        has_specifics = any(w[0].isupper() for w in words[1:] if len(w) > 1)
        has_numbers = any(c.isdigit() for c in answer)
        if not has_specifics and not has_numbers:
            return True
        return False

    def _generate_followup_prompt(self, answer: str) -> str:
        """Generate a simple follow-up prompt. The real one uses the LLM."""
        return (
            "Could you elaborate on that? I'd love to hear more specific details "
            "— perhaps a concrete example or the outcome of what you described."
        )

    # ── Stage management ────────────────────────────────────────

    def _maybe_advance_stage(self):
        """Advance to the next stage if we've exhausted the budget for the current one."""
        current = Stage(self.state.stage)
        idx = STAGE_ORDER.index(current)
        budget = STAGE_BUDGET.get(current, 2)
        questions_in_stage = sum(
            1 for q in self.state.questions_asked if q.get("stage") == current.value
        )
        if questions_in_stage >= budget and idx < len(STAGE_ORDER) - 1:
            self.state.stage = STAGE_ORDER[idx + 1].value

        # Time check — force closing if running out
        if self.state.time_remaining() < 120 and current != Stage.CLOSING:
            self.state.stage = Stage.CLOSING.value

    # ── Transcript ──────────────────────────────────────────────

    def _add_transcript(
        self, speaker: str, text: str, stt_confidence: float = 1.0
    ):
        entry = {
            "speaker": speaker,
            "text": text,
            "timestamp": time.time(),
            "stt_confidence": stt_confidence,
        }
        self.state.transcript.append(entry)

    def get_transcript(self) -> List[Dict]:
        return self.state.transcript

    def get_full_state(self) -> Dict:
        return {
            "stage": self.state.stage,
            "difficulty": self.state.difficulty,
            "current_question": self.state.current_question,
            "questions_asked": self.state.questions_asked,
            "time_started": self.state.time_started,
            "time_remaining": self.state.time_remaining(),
            "questions_remaining": self.state.questions_remaining(),
            "transcript": self.state.transcript,
            "candidate_summary": self.state.candidate_summary,
            "is_finished": self.state.is_finished,
            "session_id": self.state.session_id,
        }

    # ── Persistence ─────────────────────────────────────────────

    def _persist(self):
        """Save state + transcript to disk after every turn."""
        try:
            with open(settings.SESSION_FILE, "w", encoding="utf-8") as f:
                json.dump(self.get_full_state(), f, indent=2, default=str)
            with open(settings.TRANSCRIPT_FILE, "w", encoding="utf-8") as f:
                json.dump(self.state.transcript, f, indent=2, default=str)
        except Exception as e:
            print(f"[WARN] Failed to persist state: {e}")

    def reset_session(self, candidate_summary: Dict = None):
        """Completely reset the session and remove old persisted state files."""
        self.state = InterviewState()
        self.state.candidate_summary = candidate_summary or {}
        try:
            if os.path.exists(settings.SESSION_FILE):
                os.remove(settings.SESSION_FILE)
            if os.path.exists(settings.TRANSCRIPT_FILE):
                os.remove(settings.TRANSCRIPT_FILE)
        except Exception as e:
            print(f"[WARN] Failed to remove old session files: {e}")

    def load_session(self) -> bool:
        """Load a previously saved session. Returns True if successful."""
        try:
            if not os.path.exists(settings.SESSION_FILE):
                return False
            with open(settings.SESSION_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)

            # If the session was already finished or in closing, do not restore as active
            if data.get("is_finished") or data.get("stage") == Stage.CLOSING.value:
                print("  ℹ️ Stale/finished session found on disk, resetting.")
                self.reset_session()
                return False

            self.state = InterviewState()
            self.state.stage = data.get("stage", Stage.INTRO.value)
            self.state.difficulty = InterviewDifficulty(
                data.get("difficulty", InterviewDifficulty.BEGINNER.value)
            ).value
            self.state.questions_asked = data.get("questions_asked", [])
            self.state.time_started = data.get("time_started", time.time())
            self.state.transcript = data.get("transcript", [])
            self.state.candidate_summary = data.get("candidate_summary", {})
            self.state.is_finished = data.get("is_finished", False)
            self.state.session_id = data.get("session_id", "")
            self.state.asked_question_texts = [
                q["question"] for q in self.state.questions_asked
            ]
            self.state.current_question = data.get("current_question", "")
            if not self.state.current_question and self.state.transcript:
                agent_msgs = [m["text"] for m in self.state.transcript if m.get("speaker") == "agent"]
                if agent_msgs:
                    self.state.current_question = agent_msgs[-1]
            return True
        except FileNotFoundError:
            return False
        except Exception as e:
            print(f"[WARN] Failed to load session: {e}")
            return False

    def has_saved_session(self) -> bool:
        return os.path.exists(settings.SESSION_FILE)
