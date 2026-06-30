from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Conversation, Message, ShareLink, User

router = APIRouter()


class ShareResponse(BaseModel):
    share_id: str
    share_url: str


class SharedConversationResponse(BaseModel):
    title: str
    mode: str
    messages: list[dict]


@router.post("/conversations/{conv_id}/share", response_model=ShareResponse)
async def create_share_link(
    conv_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id, Conversation.user_id == user.id
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    existing = await db.execute(
        select(ShareLink).where(
            ShareLink.conversation_id == conv_id,
            ShareLink.user_id == user.id,
        )
    )
    link = existing.scalar_one_or_none()
    if link:
        return ShareResponse(
            share_id=link.id,
            share_url=f"/shared/{link.id}",
        )

    link = ShareLink(conversation_id=conv_id, user_id=user.id)
    db.add(link)
    await db.commit()
    await db.refresh(link)

    return ShareResponse(
        share_id=link.id,
        share_url=f"/shared/{link.id}",
    )


@router.get("/shared/{share_id}", response_model=SharedConversationResponse)
async def get_shared_conversation(
    share_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShareLink).where(ShareLink.id == share_id)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    conv_result = await db.execute(
        select(Conversation).where(Conversation.id == link.conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == link.conversation_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    return SharedConversationResponse(
        title=conv.title,
        mode=conv.mode,
        messages=[
            {"role": m.role, "content": m.content}
            for m in messages
        ],
    )
