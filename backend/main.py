"""
FastAPI application — serves the REST API and the WebSocket voice pipeline.
"""

import json
import os
from contextlib import asynccontextmanager

import sys
from pathlib import Path

# Add project root to sys.path so 'backend.*' imports resolve from anywhere
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.services.ingestion import ingest_resume_and_jd, query_chunks
from backend.services.interview import InterviewDifficulty, InterviewManager, Stage
from backend.services.question_gen import generate_question, decide_followup
from backend.services.scoring import generate_report
from backend.services.voice_pipeline import create_voice_pipeline


# ── Global state ────────────────────────────────────────────────
interview_manager = InterviewManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    # Try to restore a saved session
    if interview_manager.has_saved_session():
        loaded = interview_manager.load_session()
        if loaded:
            print("  ✅ Restored saved session")
    yield
    # Persist on shutdown
    interview_manager._persist()


app = FastAPI(
    title="AI Mock Interview Coach",
    description="Voice-first AI interview practice with grounded questions and rubric feedback.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS (allow the Vite dev server) ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════
#  REST ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.post("/api/ingest")
async def ingest_files(
    resume: UploadFile = File(...),
    job_desc: UploadFile = File(...),
):
    """Ingest resume + JD → chunk → embed → store in ChromaDB → return summary."""
    try:
        summary = await ingest_resume_and_jd(resume, job_desc)
        # Reset interview manager for the new candidate and purge stale session
        interview_manager.reset_session(candidate_summary=summary)
        return JSONResponse(content={"status": "ok", "summary": summary})
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/start")
async def start_interview(request: Request = None):
    """Start a fresh interview session."""
    global interview_manager
    candidate_summary = None
    difficulty = InterviewDifficulty.BEGINNER

    if request:
        try:
            body = await request.json()
            if not isinstance(body, dict):
                raise HTTPException(status_code=422, detail="Request body must be a JSON object")
            candidate_summary = body.get("candidate_summary")
            try:
                difficulty = InterviewDifficulty(
                    body.get("difficulty", InterviewDifficulty.BEGINNER.value)
                )
            except (TypeError, ValueError):
                valid_difficulties = [item.value for item in InterviewDifficulty]
                raise HTTPException(
                    status_code=422,
                    detail=f"Invalid difficulty. Choose one of: {', '.join(valid_difficulties)}",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    if not candidate_summary:
        candidate_summary = interview_manager.state.candidate_summary

    payload = interview_manager.start(
        candidate_summary=candidate_summary,
        difficulty=difficulty,
    )
    return JSONResponse(content={"status": "started", **payload})


@app.post("/api/next_question")
async def next_question():
    """Generate the next interview question."""
    state = interview_manager.get_full_state()

    if state["questions_remaining"] <= 0 or state["time_remaining"] <= 0:
        payload = interview_manager.end_interview()
        return JSONResponse(content={"status": "ended", **payload})

    question = generate_question(
        stage=state["stage"],
        candidate_summary=state["candidate_summary"],
        asked_questions=interview_manager.state.asked_question_texts,
        transcript=state["transcript"],
        difficulty=interview_manager.state.difficulty,
    )
    payload = interview_manager.set_next_question(question)
    return JSONResponse(content={"status": "ok", **payload})


@app.post("/api/save_answer")
async def save_answer(answer: str = Form(...)):
    """Save the candidate's answer and decide follow-up."""
    # LLM-based follow-up decision
    followup = decide_followup(
        interview_manager.state.current_question,
        answer,
        interview_manager.state.transcript,
    )

    payload = interview_manager.save_answer(answer)

    response = {"status": "ok", **payload}
    if followup:
        response["followup"] = followup
    return JSONResponse(content=response)


@app.post("/api/end_interview")
async def end_interview():
    """End the interview and generate the report."""
    interview_manager.end_interview()

    report = generate_report(
        transcript=interview_manager.state.transcript,
        questions_asked=interview_manager.state.questions_asked,
    )

    # Save report to disk
    report_path = os.path.join(settings.DATA_DIR, "report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)

    return JSONResponse(content={"status": "ok", "report": report})


@app.get("/api/state")
async def get_state():
    """Get current interview state."""
    return JSONResponse(content=interview_manager.get_full_state())


@app.get("/api/transcript")
async def get_transcript():
    """Get the full transcript."""
    return JSONResponse(content={"transcript": interview_manager.get_transcript()})


@app.post("/api/load_session")
async def load_session():
    """Load a saved session (for restart recovery)."""
    loaded = interview_manager.load_session()
    if loaded:
        return JSONResponse(content={
            "status": "loaded",
            **interview_manager.get_full_state(),
        })
    raise HTTPException(status_code=404, detail="No saved session found")


@app.get("/api/report")
async def get_report():
    """Generate report from current transcript (even after restart)."""
    if not interview_manager.state.transcript:
        # Try loading saved transcript
        loaded = interview_manager.load_session()
        if not loaded or not interview_manager.state.transcript:
            raise HTTPException(status_code=404, detail="No transcript available")

    report = generate_report(
        transcript=interview_manager.state.transcript,
        questions_asked=interview_manager.state.questions_asked,
    )
    return JSONResponse(content={"status": "ok", "report": report})


# ═══════════════════════════════════════════════════════════════
#  WEBSOCKET — PIPECAT VOICE PIPELINE
# ═══════════════════════════════════════════════════════════════

@app.websocket("/ws/voice")
async def voice_pipeline_ws(websocket: WebSocket):
    """
    WebSocket endpoint for the real-time voice pipeline.
    Connects: browser mic → VAD → STT → LLM → TTS → speaker.
    """
    await websocket.accept()
    print("  🎙️  Voice pipeline WebSocket connected")

    try:
        await create_voice_pipeline(websocket, interview_manager)
    except Exception as e:
        print(f"  ❌ Voice pipeline error: {e}")
    finally:
        interview_manager._persist()
        print("  🔇 Voice pipeline WebSocket closed")


# ═══════════════════════════════════════════════════════════════
#  TEXT-BASED FALLBACK WebSocket (when Pipecat isn't available)
# ═══════════════════════════════════════════════════════════════

@app.websocket("/ws/text")
async def text_pipeline_ws(websocket: WebSocket):
    """
    Text-only WebSocket for development / testing without mic access.
    Simulates the voice pipeline using typed messages.
    """
    await websocket.accept()
    print("  💬 Text pipeline connected")

    # Send opening — ensure session is fresh and properly initialized
    state = interview_manager.get_full_state()
    if (
        interview_manager.state.is_finished
        or interview_manager.state.stage == Stage.CLOSING.value
        or not interview_manager.state.current_question
        or not state.get("transcript")
    ):
        interview_manager.start(
            candidate_summary=interview_manager.state.candidate_summary,
            difficulty=interview_manager.state.difficulty,
        )

    await websocket.send_json({
        "type": "agent_message",
        "text": interview_manager.state.current_question,
        "state": interview_manager.state.to_payload(),
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "candidate_answer":
                answer = data.get("text", "")
                # Save answer
                payload = interview_manager.save_answer(answer)

                # If there's a follow-up, send it
                if payload.get("question"):
                    await websocket.send_json({
                        "type": "agent_message",
                        "text": payload["question"],
                        "state": payload,
                        "is_followup": True,
                    })
                else:
                    # Generate next question
                    full_state = interview_manager.get_full_state()
                    if full_state["questions_remaining"] > 0 and full_state["time_remaining"] > 0:
                        question = generate_question(
                            stage=full_state["stage"],
                            candidate_summary=full_state["candidate_summary"],
                            asked_questions=interview_manager.state.asked_question_texts,
                            transcript=full_state["transcript"],
                            difficulty=interview_manager.state.difficulty,
                        )
                        next_payload = interview_manager.set_next_question(question)
                        await websocket.send_json({
                            "type": "agent_message",
                            "text": question,
                            "state": next_payload,
                        })
                    else:
                        end_payload = interview_manager.end_interview()
                        await websocket.send_json({
                            "type": "agent_message",
                            "text": end_payload["question"],
                            "state": end_payload,
                            "is_closing": True,
                        })

            elif msg_type == "end_interview":
                end_payload = interview_manager.end_interview()
                report = generate_report(
                    transcript=interview_manager.state.transcript,
                    questions_asked=interview_manager.state.questions_asked,
                )
                await websocket.send_json({
                    "type": "report",
                    "report": report,
                    "state": end_payload,
                })
                break

    except Exception as e:
        print(f"  ❌ Text pipeline error: {e}")
    finally:
        interview_manager._persist()
        print("  💬 Text pipeline disconnected")


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
