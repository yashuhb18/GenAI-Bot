import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Conversation, Message, User
from app.services.ai import stream_chat
from app.services.quiz import build_quiz_prompt

router = APIRouter()


class QuizRequest(BaseModel):
    conversation_id: str
    num_questions: int = 5


class QuizQuestion(BaseModel):
    question: str
    type: str
    options: list[str]
    correct_answer: str
    explanation: str


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


@router.post("/quiz", response_model=QuizResponse)
async def generate_quiz(
    body: QuizRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == body.conversation_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == body.conversation_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    context = "\n".join(
        f"{'User' if m.role == 'user' else 'AI'}: {m.content}" for m in messages[-20:]
    )

    prompt = build_quiz_prompt(context, min(body.num_questions, 10))

    full_response = []
    async for chunk in stream_chat(prompt):
        full_response.append(chunk)

    raw = "".join(full_response)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        data = json.loads(raw)
        return QuizResponse(**data)
    except (json.JSONDecodeError, KeyError):
        raise HTTPException(status_code=500, detail="Failed to generate quiz. Try again.")
