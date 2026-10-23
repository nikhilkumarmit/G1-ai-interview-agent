"""
Scoring and report generation service.

Rubric dimensions (each scored 1-5):
  - Relevance:      How well the answer addresses the question and ties to resume/JD
  - Structure:      Clarity and logical flow (STAR pattern when applicable)
  - Specificity:    Use of concrete examples, numbers, project names from experience
  - Communication:  Fluency, pacing, absence of excessive filler words

Each score MUST include a transcript quote as evidence.
No hire/reject language allowed.
"""

import json
import re
from typing import Any, Dict, List

from groq import Groq

from backend.core.config import settings

# ── Rubric definition ───────────────────────────────────────────

RUBRIC = {
    "relevance": {
        "description": "How well the answer addresses the question and ties to resume/JD.",
        "weight": 0.3,
        "scale": {
            1: "Completely off-topic or irrelevant",
            2: "Partially related but misses the core question",
            3: "Addresses the question generally but lacks connection to resume/JD",
            4: "Directly addresses the question with clear relevance",
            5: "Exceptional — directly answers with strong resume/JD connections",
        },
    },
    "structure": {
        "description": "Clarity and logical flow (STAR pattern when applicable).",
        "weight": 0.2,
        "scale": {
            1: "Incoherent or rambling",
            2: "Some structure but hard to follow",
            3: "Reasonable flow but missing key elements",
            4: "Clear logical structure or partial STAR",
            5: "Excellent STAR format or crystal-clear logical progression",
        },
    },
    "specificity": {
        "description": "Use of concrete examples, numbers, or project names.",
        "weight": 0.3,
        "scale": {
            1: "Entirely generic with no specifics",
            2: "One vague detail mentioned",
            3: "Some specifics but could elaborate more",
            4: "Multiple concrete examples or data points",
            5: "Rich in specific details, metrics, and verifiable claims",
        },
    },
    "communication": {
        "description": "Fluency, pacing, and absence of excessive filler words.",
        "weight": 0.2,
        "scale": {
            1: "Very difficult to understand, excessive fillers",
            2: "Frequent pauses and fillers, unclear phrasing",
            3: "Adequate communication with some fillers",
            4: "Clear and fluent with minimal fillers",
            5: "Exceptionally articulate and confident delivery",
        },
    },
}

FILLER_WORDS = {"um", "uh", "like", "you know", "actually", "basically",
                "sort of", "kind of", "i mean", "right", "so yeah"}


# ── Speech metrics ──────────────────────────────────────────────

def compute_speech_metrics(transcript: List[Dict]) -> Dict[str, Any]:
    """Compute WPM, long pauses, and filler word count from the transcript."""
    candidate_entries = [e for e in transcript if e["speaker"] == "candidate"]
    if not candidate_entries:
        return {"words_per_minute": 0, "long_pauses": 0, "filler_word_count": 0,
                "total_candidate_words": 0, "filler_words_detail": {}}

    all_text = " ".join(e["text"] for e in candidate_entries)
    words = all_text.split()
    total_words = len(words)

    # WPM from timestamps
    timestamps = [e["timestamp"] for e in candidate_entries]
    if len(timestamps) >= 2:
        duration_min = (max(timestamps) - min(timestamps)) / 60.0
        wpm = total_words / duration_min if duration_min > 0 else 0
    else:
        wpm = 0

    # Long pauses (> 2s between candidate utterances)
    long_pauses = 0
    for prev, cur in zip(candidate_entries, candidate_entries[1:]):
        gap = cur["timestamp"] - prev["timestamp"]
        if gap > 2.0:
            long_pauses += 1

    # Filler words
    lower_text = all_text.lower()
    filler_detail = {}
    filler_total = 0
    for filler in FILLER_WORDS:
        count = lower_text.count(filler)
        if count:
            filler_detail[filler] = count
            filler_total += count

    return {
        "words_per_minute": round(wpm, 1),
        "long_pauses": long_pauses,
        "filler_word_count": filler_total,
        "total_candidate_words": total_words,
        "filler_words_detail": filler_detail,
    }


# ── LLM-based scoring ──────────────────────────────────────────

def score_answer_via_llm(question: str, answer: str) -> Dict[str, Any]:
    """
    Score a single Q&A pair using the Groq LLM against the rubric.
    Returns scores + evidence quotes for each dimension.
    """
    rubric_text = json.dumps(
        {k: {"description": v["description"], "scale": v["scale"]}
         for k, v in RUBRIC.items()},
        indent=2,
    )

    client = Groq(api_key=settings.GROQ_API_KEY)
    prompt = f"""Score the following interview answer on 4 dimensions.
For EACH dimension, provide:
1. A score from 1 to 5
2. A SHORT quote from the answer as evidence (max 30 words)

Return ONLY a JSON object like:
{{
  "relevance": {{"score": 4, "evidence": "quote..."}},
  "structure": {{"score": 3, "evidence": "quote..."}},
  "specificity": {{"score": 5, "evidence": "quote..."}},
  "communication": {{"score": 4, "evidence": "quote..."}}
}}

RUBRIC:
{rubric_text}

QUESTION: {question}

ANSWER: {answer}

IMPORTANT: Every score MUST be justified by a direct quote from the answer.
No hire/reject language. Only constructive feedback.
"""

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=400,
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown fences
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: return neutral scores
        return {dim: {"score": 3, "evidence": "(scoring error)"} for dim in RUBRIC}


# ── Report generation ──────────────────────────────────────────

def generate_report(transcript: List[Dict], questions_asked: List[Dict] = None) -> Dict[str, Any]:
    """
    Generate the full feedback report:
    - Per-answer rubric scores with evidence quotes
    - Speech metrics (WPM, pauses, fillers)
    - Top 3 strengths + 3 improvements
    - Full transcript
    - NO hire/reject language
    """
    # ── Score each Q&A pair ─────────────────────────────────────
    scored_answers = []
    if questions_asked:
        for qa in questions_asked:
            q = qa.get("question", "")
            a = qa.get("answer", "")
            if not a:
                continue
            scores = score_answer_via_llm(q, a)
            scored_answers.append({
                "question": q,
                "answer": a,
                "stage": qa.get("stage", ""),
                "scores": scores,
            })
    else:
        # Fallback: reconstruct from transcript pairs
        for i in range(0, len(transcript) - 1):
            if transcript[i]["speaker"] == "agent" and i + 1 < len(transcript) and transcript[i + 1]["speaker"] == "candidate":
                q = transcript[i]["text"]
                a = transcript[i + 1]["text"]
                scores = score_answer_via_llm(q, a)
                scored_answers.append({
                    "question": q,
                    "answer": a,
                    "scores": scores,
                })

    # ── Speech metrics ──────────────────────────────────────────
    speech = compute_speech_metrics(transcript)

    # ── Derive strengths and improvements ───────────────────────
    strengths, improvements = _derive_insights(scored_answers)

    # ── Compute overall score ───────────────────────────────────
    overall = _compute_overall(scored_answers)

    report = {
        "rubric_definition": {k: v["description"] for k, v in RUBRIC.items()},
        "scored_answers": scored_answers,
        "overall_scores": overall,
        "speech_metrics": speech,
        "strengths": strengths[:3],
        "improvements": improvements[:3],
        "full_transcript": transcript,
        "disclaimer": (
            "This report provides practice feedback only. "
            "No hiring decision or recommendation has been made."
        ),
    }
    return report


def _derive_insights(scored_answers: List[Dict]) -> tuple:
    """Extract top strengths and areas for improvement from scored answers."""
    strengths = []
    improvements = []

    for sa in scored_answers:
        for dim, data in sa.get("scores", {}).items():
            score = data.get("score", 3) if isinstance(data, dict) else 3
            evidence = data.get("evidence", "") if isinstance(data, dict) else ""
            q_preview = sa["question"][:50]

            if score >= 4:
                strengths.append({
                    "dimension": dim,
                    "score": score,
                    "context": f"In response to '{q_preview}...'",
                    "evidence": evidence,
                })
            elif score <= 2:
                improvements.append({
                    "dimension": dim,
                    "score": score,
                    "context": f"In response to '{q_preview}...'",
                    "evidence": evidence,
                })

    # Sort by score (best strengths first, worst improvements first)
    strengths.sort(key=lambda x: x["score"], reverse=True)
    improvements.sort(key=lambda x: x["score"])
    return strengths, improvements


def _compute_overall(scored_answers: List[Dict]) -> Dict[str, float]:
    """Compute weighted overall scores across all answers."""
    if not scored_answers:
        return {dim: 0.0 for dim in RUBRIC}

    totals = {dim: 0.0 for dim in RUBRIC}
    counts = {dim: 0 for dim in RUBRIC}

    for sa in scored_answers:
        for dim, data in sa.get("scores", {}).items():
            if dim in RUBRIC:
                score = data.get("score", 3) if isinstance(data, dict) else 3
                totals[dim] += score
                counts[dim] += 1

    averages = {}
    for dim in RUBRIC:
        avg = totals[dim] / counts[dim] if counts[dim] > 0 else 0
        averages[dim] = round(avg, 2)

    # Weighted composite
    composite = sum(
        averages[dim] * RUBRIC[dim]["weight"]
        for dim in RUBRIC
        if dim in averages
    )
    averages["composite"] = round(composite, 2)
    return averages
