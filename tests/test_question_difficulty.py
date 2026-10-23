import unittest
from unittest.mock import Mock, patch

from backend.services.interview import InterviewManager
from backend.services.question_gen import generate_question


class QuestionDifficultyTests(unittest.TestCase):
    def test_interview_session_keeps_selected_difficulty(self):
        manager = InterviewManager()
        with patch.object(manager, "_persist"):
            payload = manager.start(
                candidate_summary={"candidate_name": "Candidate"},
                question_difficulty="advanced",
            )

        self.assertEqual(payload["question_difficulty"], "advanced")
        self.assertEqual(manager.get_full_state()["question_difficulty"], "advanced")

    def test_question_prompt_includes_selected_difficulty_guidance(self):
        expected_guidance = {
            "beginner": "easy, foundational questions",
            "intermediate": "moderately challenging, practical questions",
            "advanced": "challenging questions that probe depth",
        }

        for difficulty, guidance in expected_guidance.items():
            with self.subTest(difficulty=difficulty):
                client = Mock()
                response = Mock()
                response.choices = [Mock(message=Mock(content="Tell me about your project?"))]
                client.chat.completions.create.return_value = response

                with (
                    patch(
                        "backend.services.question_gen.query_chunks",
                        return_value=[],
                    ),
                    patch(
                        "backend.services.question_gen.Groq",
                        return_value=client,
                    ),
                ):
                    generate_question(
                        stage="resume_questions",
                        candidate_summary={},
                        asked_questions=[],
                        transcript=[],
                        difficulty=difficulty,
                    )

                prompt = client.chat.completions.create.call_args.kwargs[
                    "messages"
                ][1]["content"]
                self.assertIn(f"Question difficulty: {difficulty}", prompt)
                self.assertIn(guidance, prompt)

    def test_interview_session_keeps_selected_type(self):
        manager = InterviewManager()
        with patch.object(manager, "_persist"):
            payload = manager.start(
                candidate_summary={"candidate_name": "Candidate"},
                interview_type="technical",
            )

        self.assertEqual(payload["interview_type"], "technical")
        self.assertEqual(manager.get_full_state()["interview_type"], "technical")

    def test_question_prompt_includes_interview_type_guidance(self):
        expected_guidance = {
            "technical": "Prioritize technical knowledge",
            "behavioral": "Prioritize behavioral questions",
            "hr": "Prioritize motivation, communication",
            "mixed": "Balance technical experience",
        }

        for interview_type, guidance in expected_guidance.items():
            with self.subTest(interview_type=interview_type):
                client = Mock()
                response = Mock()
                response.choices = [Mock(message=Mock(content="Tell me about your project?"))]
                client.chat.completions.create.return_value = response

                with (
                    patch(
                        "backend.services.question_gen.query_chunks",
                        return_value=[],
                    ),
                    patch(
                        "backend.services.question_gen.Groq",
                        return_value=client,
                    ),
                ):
                    generate_question(
                        stage="resume_questions",
                        candidate_summary={},
                        asked_questions=[],
                        transcript=[],
                        interview_type=interview_type,
                    )

                prompt = client.chat.completions.create.call_args.kwargs[
                    "messages"
                ][1]["content"]
                self.assertIn(f"Interview type: {interview_type}", prompt)
                self.assertIn(guidance, prompt)


if __name__ == "__main__":
    unittest.main()
