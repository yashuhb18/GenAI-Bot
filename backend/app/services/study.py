STUDY_PLAN_PROMPT = """You are a study planner AI. Given a topic or conversation context, create a structured study plan.

RULES:
1. Create a realistic study plan that can be completed in the specified number of days.
2. Break the topic into manageable daily chunks.
3. Each day should have: topic, key_concepts (list), estimated_time_minutes, practice_tasks (list).
4. Include review days.
5. Return ONLY valid JSON, no markdown.

Return format:
{
  "title": "Study Plan: [Topic]",
  "total_days": N,
  "daily_plans": [
    {
      "day": 1,
      "topic": "...",
      "key_concepts": ["concept1", "concept2"],
      "estimated_time_minutes": 60,
      "practice_tasks": ["task1", "task2"],
      "completed": false
    }
  ]
}"""


def build_study_plan_prompt(context: str, days: int = 7) -> list[dict]:
    return [
        {"role": "system", "content": STUDY_PLAN_PROMPT},
        {
            "role": "user",
            "content": f"Create a {days}-day study plan for this topic:\n\n{context}\n\nReturn ONLY the JSON.",
        },
    ]
