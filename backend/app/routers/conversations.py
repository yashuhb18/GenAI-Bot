from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Conversation, Message, User
from app.schemas import ConversationCreate, ConversationOut, DashboardOut, MessageOut

router = APIRouter()

VALID_MODES = ["general", "explain", "homework", "code", "exam", "research"]


class ModeUpdate(BaseModel):
    mode: str


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    print(f"[CONV] List for user: {user.id} ({user.username})")
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
    )
    convs = result.scalars().all()
    print(f"[CONV] Found {len(convs)} conversations")
    return convs


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(
    body: ConversationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = Conversation(user_id=user.id, title=body.title, mode=body.mode)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/conversations/{conv_id}/messages", response_model=list[MessageOut])
async def get_messages(
    conv_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id, Conversation.user_id == user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Not found")
    msgs = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    return msgs.scalars().all()


@router.patch("/conversations/{conv_id}/mode", response_model=ConversationOut)
async def update_conversation_mode(
    conv_id: str,
    body: ModeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Must be one of: {', '.join(VALID_MODES)}")
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id, Conversation.user_id == user.id
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    conv.mode = body.mode
    await db.commit()
    await db.refresh(conv)
    return conv


@router.delete("/conversations/{conv_id}", status_code=204)
async def delete_conversation(
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
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(conv)
    await db.commit()


@router.get("/conversations/search", response_model=list[ConversationOut])
async def search_conversations(
    q: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not q.strip():
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user.id)
            .order_by(Conversation.updated_at.desc())
            .limit(20)
        )
        return result.scalars().all()

    search_term = f"%{q}%"
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.user_id == user.id,
            or_(
                Conversation.title.ilike(search_term),
                Conversation.id.in_(
                    select(Message.conversation_id)
                    .where(Message.content.ilike(search_term))
                ),
            ),
        )
        .order_by(Conversation.updated_at.desc())
        .limit(20)
    )
    return result.scalars().all()


@router.get("/conversations/{conv_id}/export")
async def export_conversation(
    conv_id: str,
    fmt: str = "markdown",
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
        raise HTTPException(status_code=404, detail="Not found")

    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    if fmt == "markdown":
        lines = [f"# {conv.title}\n"]
        for msg in messages:
            role = "**You**" if msg.role == "user" else "**AvenZa-AI**"
            lines.append(f"### {role}\n\n{msg.content}\n")
        content = "\n---\n\n".join(lines)
        return PlainTextResponse(
            content,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{conv.title}.md"'},
        )

    raise HTTPException(status_code=400, detail="Unsupported format. Use 'markdown'.")


@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(10)
    )
    recent_conversations = conv_result.scalars().all()

    total_conv_result = await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.user_id == user.id)
    )
    total_conversations = total_conv_result.scalar() or 0

    conv_ids = [c.id for c in recent_conversations]
    total_msg_result = await db.execute(
        select(func.count()).select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.user_id == user.id)
    )
    total_messages = total_msg_result.scalar() or 0

    recent_with_preview = []
    for conv in recent_conversations:
        msg_result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()
        recent_with_preview.append({
            "id": conv.id,
            "title": conv.title,
            "mode": conv.mode,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "last_message": last_msg.content if last_msg else None,
        })

    return DashboardOut(
        recent_conversations=[
            ConversationOut(
                id=c["id"],
                title=c["title"],
                mode=c.get("mode", "general"),
                created_at=c["created_at"],
                updated_at=c["updated_at"],
            )
            for c in recent_with_preview
        ],
        total_conversations=total_conversations,
        total_messages=total_messages,
        user_info={
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "auth_provider": user.auth_provider,
            "avatar_url": user.avatar_url,
        },
    )
