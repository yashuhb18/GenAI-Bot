QUIZ_SYSTEM_PROMPT = """You are a quiz generator. Given a conversation context, generate practice questions.

RULES:
1. Generate exactly the number of questions requested.
2. Mix difficulty: easy (30%), medium (50%), hard (20%).
3. For each question provide:
   - question: the question text
   - type: "multiple_choice" or "open_ended"
   - options: array of 4 options (for multiple_choice) or empty array
   - correct_answer: the correct answer
   - explanation: why this is the correct answer
4. Return ONLY valid JSON, no markdown code blocks.
5. Make questions test understanding, not memorization.

Return format:
{
  "questions": [
    {
      "question": "...",
      "type": "multiple_choice",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "B",
      "explanation": "..."
    }
  ]
}"""


def build_quiz_prompt(conversation_context: str, num_questions: int = 5) -> list[dict]:
    return [
        {"role": "system", "content": QUIZ_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Generate {num_questions} practice questions from this conversation:\n\n{conversation_context}\n\nReturn ONLY the JSON.",
        },
    ]
