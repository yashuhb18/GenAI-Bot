import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_access_token
from app.database import async_session, get_db
from app.dependencies import check_rate_limit, get_current_user
from app.models import Conversation, Message, User
from app.schemas import ChatRequest
from app.services.ai import stream_chat

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are AvenZa-AI — an unhinged AI genius with the brain of a senior engineer and the humor of a stand-up comic.

## CORE RULE #1: MATCH THE QUESTION SIZE
- Casual question = casual answer. 2-4 sentences MAX. Stop.
- "What is X?" → short punchy answer with ONE analogy, not a textbook chapter.
- "Write me a function" → code + 1-2 lines explaining it. Done.
- "Explain in detail" or "Go deeper" → NOW you go deep with headers, code, examples.
- "How do I..." → answer + code. No essay before the code.

## PERSONALITY
- You're the friend who's cracked at everything and roasts you with love.
- You use metaphors that hit different: "APIs are waiters for code", "recursion is a function having an identity crisis"
- You're brutally honest but always helpful.
- You have strong opinions. If someone writes bad code, you say so (politely).
- You use 😏, 🔥, 💀 when it adds flavor. Not in every message.

## STYLE
- NEVER start with "Sure!", "Great question!", "Absolutely!", "Of course!" — instant cringe.
- Code first, talk second (for code questions).
- Use markdown ONLY for code blocks, headers, and emphasis. No walls of bullet points for simple answers.
- If the answer fits in 3 lines, don't make it 30.
- End casual answers with a follow-up hook: "Want me to go deeper?" or "Need the advanced version?"

## WHAT MAKES YOU DIFFERENT
- You give the ONE best answer, not five options.
- You pick fights with bad practices. "Don't use eval(). That's how you get hacked."
- You make boring topics interesting through analogies.
- You remember context from the conversation and build on it.

## NEVER
- Write essays for simple questions
- Say "I hope this helps!" or "Let me know if you have any questions!"
- Give wishy-washy "it depends" without taking a stance
- Repeat the question back to them
- Use corporate buzzwords or filler"""


async def _build_messages(db: AsyncSession, conversation_id: str) -> list[dict]:
    history = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history.scalars():
        messages.append({"role": msg.role, "content": msg.content})
    return messages


async def _save_user_message(db: AsyncSession, conversation_id: str, content: str) -> None:
    db.add(Message(conversation_id=conversation_id, role="user", content=content))
    await db.commit()


async def _save_assistant_message(db: AsyncSession, conversation_id: str, content: str) -> None:
    db.add(Message(conversation_id=conversation_id, role="assistant", content=content))
    await db.commit()


@router.websocket("/ws/chat/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str):
    await websocket.accept()

    token = websocket.query_params.get("token")
    user_id = decode_access_token(token) if token else None
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    async for db in get_db():
        try:
            while True:
                raw = await websocket.receive_text()
                data = json.loads(raw)
                user_message = data.get("content", "")

                check_rate_limit(user_id)

                result = await db.execute(
                    select(Conversation).where(
                        Conversation.id == conversation_id,
                        Conversation.user_id == user_id,
                    )
                )
                conv = result.scalar_one_or_none()
                if not conv:
                    await websocket.send_text(
                        json.dumps({"type": "error", "content": "Conversation not found"})
                    )
                    continue

                await _save_user_message(db, conversation_id, user_message)

                if conv.title == "New Chat":
                    conv.title = user_message[:80]
                    await db.commit()

                ai_messages = await _build_messages(db, conversation_id)

                full_response: list[str] = []
                await websocket.send_text(json.dumps({"type": "start"}))
                async for chunk in stream_chat(ai_messages):
                    full_response.append(chunk)
                    await websocket.send_text(
                        json.dumps({"type": "chunk", "content": chunk})
                    )
                await websocket.send_text(json.dumps({"type": "end"}))

                await _save_assistant_message(db, conversation_id, "".join(full_response))

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected for conv %s", conversation_id)
            break
        except Exception as e:
            logger.exception("WebSocket error for conv %s", conversation_id)
            await websocket.send_text(
                json.dumps({"type": "error", "content": str(e)})
            )


async def _sse_stream(
    conversation_id: str, user_message: str
) -> AsyncGenerator[str]:
    async with async_session() as db:
        await _save_user_message(db, conversation_id, user_message)

        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        if conv and conv.title == "New Chat":
            conv.title = user_message[:80]
            await db.commit()

        ai_messages = await _build_messages(db, conversation_id)

        full_response: list[str] = []
        async for chunk in stream_chat(ai_messages):
            full_response.append(chunk)
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

        await _save_assistant_message(db, conversation_id, "".join(full_response))


@router.post("/chat/{conversation_id}/stream")
async def rest_stream_chat(
    conversation_id: str,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(user.id)

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user.id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")

    return StreamingResponse(
        _sse_stream(conversation_id, body.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
