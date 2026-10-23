"""Offline tests for interview difficulty selection and propagation."""

import asyncio
import json
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

from backend import main
from backend.services.interview import InterviewDifficulty, InterviewManager, InterviewState
from backend.services.question_gen import generate_question


class JsonRequest:
    def __init__(self, body):
        self.body = body

    async def json(self):
        return self.body


class StartInterviewTests(unittest.TestCase):
    def setUp(self):
        self.original_manager = main.interview_manager
        self.manager = Mock()
        self.manager.state.candidate_summary = {"candidate_name": "Test Candidate"}
        self.manager.start.side_effect = lambda candidate_summary=None, difficulty=None: {
            "difficulty": difficulty.value,
            "candidate_summary": candidate_summary,
        }
        main.interview_manager = self.manager

    def tearDown(self):
        main.interview_manager = self.original_manager

    def test_start_accepts_all_difficulty_levels(self):
        for difficulty in InterviewDifficulty:
            with self.subTest(difficulty=difficulty.value):
                response = asyncio.run(
                    main.start_interview(JsonRequest({"difficulty": difficulty.value}))
                )
                self.assertEqual(json.loads(response.body), {
                    "status": "started",
                    "difficulty": difficulty.value,
                    "candidate_summary": self.manager.state.candidate_summary,
                })

    def test_start_rejects_invalid_difficulty(self):
        with self.assertRaises(HTTPException) as error:
            asyncio.run(main.start_interview(JsonRequest({"difficulty": "Expert"})))

        self.assertEqual(error.exception.status_code, 422)
        self.manager.start.assert_not_called()

    def test_legacy_request_defaults_to_beginner(self):
        response = asyncio.run(
            main.start_interview(
                JsonRequest({"candidate_summary": {"candidate_name": "Legacy Candidate"}})
            )
        )

        body = json.loads(response.body)
        self.assertEqual(body["difficulty"], InterviewDifficulty.BEGINNER.value)
        self.assertEqual(
            body["candidate_summary"],
            {"candidate_name": "Legacy Candidate"},
        )

    def test_request_without_body_defaults_to_beginner(self):
        response = asyncio.run(main.start_interview())

        body = json.loads(response.body)
        self.assertEqual(body["difficulty"], InterviewDifficulty.BEGINNER.value)
        self.manager.start.assert_called_once_with(
            candidate_summary=self.manager.state.candidate_summary,
            difficulty=InterviewDifficulty.BEGINNER,
        )

    def test_first_question_uses_selected_difficulty(self):
        for difficulty, phrase in (
            (InterviewDifficulty.BEGINNER, "what interests you"),
            (InterviewDifficulty.INTERMEDIATE, "experience most relevant"),
            (InterviewDifficulty.ADVANCED, "technically challenging achievement"),
        ):
            with self.subTest(difficulty=difficulty.value):
                manager = InterviewManager.__new__(InterviewManager)
                manager.state = InterviewState()
                with patch.object(InterviewManager, "_persist"):
                    payload = manager.start(difficulty=difficulty)

                self.assertEqual(payload["difficulty"], difficulty.value)
                self.assertIn(phrase, payload["question"])


class QuestionGenerationDifficultyTests(unittest.TestCase):
    def test_all_levels_change_prompt_and_preserve_resume_and_jd_context(self):
        guidance = {
            InterviewDifficulty.BEGINNER: "basic definitions and introductory questions",
            InterviewDifficulty.INTERMEDIATE: "practical technical questions",
            InterviewDifficulty.ADVANCED: "deeper technical and problem-solving questions",
        }

        for difficulty, expected_guidance in guidance.items():
            with self.subTest(difficulty=difficulty.value):
                client = Mock()
                client.chat.completions.create.return_value.choices = [
                    SimpleNamespace(
                        message=SimpleNamespace(content="What did you build?")
                    )
                ]

                def retrieve_chunks(_query, source, n_results):
                    self.assertEqual(n_results, 3 if source == "resume" else 2)
                    return [{"text": f"{source} grounding context"}]

                with (
                    patch("backend.services.question_gen.Groq", return_value=client),
                    patch(
                        "backend.services.question_gen.query_chunks",
                        side_effect=retrieve_chunks,
                    ) as retrieve,
                ):
                    question = generate_question(
                        stage="resume_questions",
                        candidate_summary={"skills_found": ["Python"]},
                        asked_questions=[],
                        transcript=[],
                        difficulty=difficulty,
                    )

                self.assertEqual(question, "What did you build?")
                self.assertEqual(retrieve.call_count, 2)
                messages = client.chat.completions.create.call_args.kwargs["messages"]
                system_prompt = messages[0]["content"]
                user_prompt = messages[1]["content"]
                self.assertIn(difficulty.value, system_prompt)
                self.assertIn(expected_guidance, system_prompt)
                self.assertIn("resume grounding context", user_prompt)
                self.assertIn("job_desc grounding context", user_prompt)

    def test_question_generation_defaults_to_beginner(self):
        client = Mock()
        client.chat.completions.create.return_value.choices = [
            SimpleNamespace(message=SimpleNamespace(content="What did you build?"))
        ]
        with (
            patch("backend.services.question_gen.Groq", return_value=client),
            patch(
                "backend.services.question_gen.query_chunks",
                return_value=[{"text": "grounding context"}],
            ),
        ):
            generate_question(
                stage="resume_questions",
                candidate_summary={},
                asked_questions=[],
                transcript=[],
            )

        messages = client.chat.completions.create.call_args.kwargs["messages"]
        self.assertIn("DIFFICULTY: Beginner", messages[0]["content"])
        self.assertIn("basic definitions", messages[0]["content"])

    def test_question_generation_rejects_invalid_difficulty(self):
        with self.assertRaises(ValueError):
            generate_question(
                stage="resume_questions",
                candidate_summary={},
                asked_questions=[],
                transcript=[],
                difficulty="Expert",
            )


if __name__ == "__main__":
    unittest.main()
