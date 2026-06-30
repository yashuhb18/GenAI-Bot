import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Conversation, Message, User
from app.services.ai import stream_chat
from app.services.study import build_study_plan_prompt

router = APIRouter()


class StudyPlanRequest(BaseModel):
    conversation_id: str | None = None
    topic: str | None = None
    days: int = 7


class DailyPlan(BaseModel):
    day: int
    topic: str
    key_concepts: list[str]
    estimated_time_minutes: int
    practice_tasks: list[str]
    completed: bool = False


class StudyPlanResponse(BaseModel):
    title: str
    total_days: int
    daily_plans: list[DailyPlan]


@router.post("/study-plan", response_model=StudyPlanResponse)
async def generate_study_plan(
    body: StudyPlanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    context = ""

    if body.conversation_id:
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

    if body.topic:
        context = f"Topic: {body.topic}\n\n{context}"

    if not context:
        raise HTTPException(status_code=400, detail="Provide a conversation_id or topic")

    days = min(max(body.days, 1), 30)
    prompt = build_study_plan_prompt(context, days)

    full_response = []
    async for chunk in stream_chat(prompt):
        full_response.append(chunk)

    raw = "".join(full_response).strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        data = json.loads(raw)
        return StudyPlanResponse(**data)
    except (json.JSONDecodeError, KeyError):
        raise HTTPException(status_code=500, detail="Failed to generate study plan. Try again.")
