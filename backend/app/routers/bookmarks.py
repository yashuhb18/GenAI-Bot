from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Bookmark, Message, User

router = APIRouter()


class BookmarkCreate(BaseModel):
    conversation_id: str
    message_id: str
    note: str | None = None


class BookmarkOut(BaseModel):
    id: str
    conversation_id: str
    message_id: str
    content: str
    note: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/bookmarks", response_model=list[BookmarkOut])
async def list_bookmarks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark)
        .where(Bookmark.user_id == user.id)
        .order_by(Bookmark.created_at.desc())
    )
    bookmarks = result.scalars().all()

    output = []
    for bm in bookmarks:
        msg_result = await db.execute(
            select(Message).where(Message.id == bm.message_id)
        )
        msg = msg_result.scalar_one_or_none()
        output.append(BookmarkOut(
            id=bm.id,
            conversation_id=bm.conversation_id,
            message_id=bm.message_id,
            content=msg.content if msg else "",
            note=bm.note,
            created_at=bm.created_at.isoformat() if bm.created_at else "",
        ))
    return output


@router.post("/bookmarks", response_model=BookmarkOut)
async def create_bookmark(
    body: BookmarkCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Bookmark).where(
            Bookmark.user_id == user.id,
            Bookmark.message_id == body.message_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already bookmarked")

    msg_result = await db.execute(
        select(Message).where(Message.id == body.message_id)
    )
    msg = msg_result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    bookmark = Bookmark(
        user_id=user.id,
        conversation_id=body.conversation_id,
        message_id=body.message_id,
        note=body.note,
    )
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)

    return BookmarkOut(
        id=bookmark.id,
        conversation_id=bookmark.conversation_id,
        message_id=bookmark.message_id,
        content=msg.content,
        note=bookmark.note,
        created_at=bookmark.created_at.isoformat() if bookmark.created_at else "",
    )


@router.delete("/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(
    bookmark_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark).where(
            Bookmark.id == bookmark_id,
            Bookmark.user_id == user.id,
        )
    )
    bookmark = result.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(bookmark)
    await db.commit()
