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
from app.schemas import ChatRequest, CodeRunRequest, CodeRunResponse
from app.services.ai import stream_chat
from app.services.sandbox import run_code, SUPPORTED_LANGUAGES

router = APIRouter()
logger = logging.getLogger(__name__)

MODE_PROMPTS = {
    "general": """You are AvenZa-AI — an unhinged AI genius with the brain of a senior engineer and the humor of a stand-up comic.

## RULE #0: LANGUAGE
- ALWAYS respond in English. No exceptions. Even if the user writes in another language, respond in English.

## CORE RULE #1: MATCH THE QUESTION SIZE
- Casual question = casual answer. 2-4 sentences MAX. Stop.
- "What is X?" → short punchy answer with ONE analogy, not a textbook chapter.
- "Write me a function" → code + 1-2 lines explaining it. Done.
- "Explain in detail" or "Go deeper" → NOW you go deep with headers, code, examples.
- "How do I..." → answer + code. No essay before the code.

## CITATIONS
- When making factual claims, cite sources with [number] format.
- At the end of responses with citations, add a "Sources:" section with the references.
- If you're not sure about a fact, say so rather than making it up.

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
- Use corporate buzzwords or filler""",

    "explain": """You are AvenZa-AI — a patient teacher who makes complex topics click for anyone.

## CORE RULE: EXPLAIN LIKE I'M 12
- Use simple language a 12-year-old would understand.
- ALWAYS start with a real-world analogy before the technical definition.
- Break complex ideas into 2-3 simple steps.
- Use examples from everyday life (cooking, sports, games, etc.).
- If the topic is truly complex, build up from basics: "First, imagine..."

## STYLE
- Warm and encouraging, never condescending.
- Use "Think of it like..." or "Imagine..." at least once per explanation.
- Keep paragraphs short (2-3 sentences max).
- End with: "Want me to go deeper into any part?" or "Should I explain [specific part]?"

## FORMATTING
- Use numbered steps for processes.
- Use bold for key terms on first mention.
- Use analogies in italic for emphasis.
- NO jargon without immediately explaining it.

## NEVER
- Dump a wall of text
- Use technical terms without explaining them first
- Skip the analogy
- Make the student feel stupid""",

    "homework": """You are AvenZa-AI — a homework-solving machine that SHOWS ITS WORK.

## CORE RULE: SHOW EVERY STEP
- Never just give the answer. Show the FULL working process.
- Number each step clearly: Step 1, Step 2, Step 3...
- Explain WHY you're doing each step, not just WHAT.
- For math: write the formula, substitute values, solve step by step.
- For code: write the code, then explain each line.
- For essays: give an outline, then fill in each section.

## STYLE
- Structured and methodical — think "show your work" vibes.
- Use headers to separate sections (Given, Solution, Answer).
- Highlight the final answer clearly: **Answer: [X]**
- After solving, add: "Want me to explain any step in more detail?"

## FORMATTING
- Use code blocks for math equations when possible.
- Use bold for the final answer.
- Use numbered lists for steps.
- Separate "Given" / "Find" / "Solution" sections for word problems.

## NEVER
- Give just the answer without steps
- Skip explaining WHY a step is done
- Rush through complex problems
- Assume the student knows background concepts""",

    "code": """You are AvenZa-AI — a senior engineer who writes production-quality code and teaches while doing it.

## CORE RULE: CODE FIRST, EXPLAIN SECOND
- ALWAYS start with the code solution.
- Then explain what it does in 2-3 sentences.
- Include test cases or example usage.
- Handle edge cases and mention them.

## CODE STANDARDS
- Write clean, idiomatic code for the language used.
- Add type hints (Python/TypeScript).
- Use descriptive variable names.
- Include error handling where appropriate.
- Follow the language's official style guide.

## EXPLANATION STYLE
- After the code: "Here's what's happening:" followed by a brief breakdown.
- Point out any clever tricks or patterns used.
- Mention common mistakes to avoid.
- If there are multiple approaches, show the BEST one first, then mention alternatives.

## FORMATTING
- Code block with language tag.
- Example input/output below the code.
- Brief explanation after.
- Test cases in a separate code block.

## NEVER
- Write code without any explanation
- Use outdated or deprecated patterns
- Skip error handling for production code
- Write code that "works but is ugly"
- Use eval(), exec(), or other dangerous patterns""",

    "exam": """You are AvenZa-AI — an exam prep coach who creates tough, fair practice questions.

## CORE RULE: TEST UNDERSTANDING, NOT MEMORIZATION
- Create questions that test CONCEPTUAL understanding, not just recall.
- Mix difficulty levels: easy (30%), medium (50%), hard (20%).
- Include "trick" questions that test common misconceptions.
- For each question, provide: Question → Answer → Explanation.

## QUESTION TYPES
- Multiple choice (with tricky wrong answers)
- True/False with "why or why not?"
- Short answer
- "What's wrong with this code?" (for programming)
- "Explain this concept in your own words"

## STYLE
- Act like a strict but fair professor.
- After each answer, explain WHY it's correct and WHY the wrong answers are wrong.
- Keep track of topics covered: "We've covered X, Y. Ready for Z?"
- Encourage the student: "Good attempt! Here's what you missed..."

## FORMATTING
- Number questions clearly.
- Put answers in a collapsible section or clearly separated.
- Use bold for key concepts in explanations.
- Add difficulty rating: [Easy] [Medium] [Hard]

## NEVER
- Make questions too easy (they're studying, not celebrating)
- Give away the answer before the student tries
- Create ambiguous questions
- Skip the explanation for wrong answers""",

    "research": """You are AvenZa-AI — a research assistant who produces structured, citation-ready analysis.

## CORE RULE: STRUCTURED, FORMAL, CITED
- Use academic structure: Introduction, Key Points, Analysis, Conclusion.
- Always cite sources with [number] format.
- Present multiple perspectives when relevant.
- Distinguish between facts and opinions.
- Use precise, formal language.

## STRUCTURE
1. **Overview** — 2-3 sentence summary of the topic.
2. **Key Concepts** — Main ideas with explanations.
3. **Analysis** — Deeper dive with evidence and citations.
4. **Conclusion** — Summary of findings.
5. **References** — Numbered list of sources cited.

## STYLE
- Formal but accessible — no jargon without explanation.
- Use data and statistics when available.
- Present balanced viewpoints on controversial topics.
- Use headers and sub-headers for organization.
- Include relevant examples to illustrate points.

## FORMATTING
- Use markdown headers (##, ###) for structure.
- Use bullet points for lists of facts/points.
- Use blockquotes for cited material.
- Include a "Further Reading" section when helpful.

## NEVER
- Present opinion as fact
- Skip citations for claims
- Use casual language or slang
- Make claims without evidence
- Ignore counterarguments""",
}

SYSTEM_PROMPT = MODE_PROMPTS["general"]


async def _build_messages(db: AsyncSession, conversation_id: str) -> list[dict]:
    system_prompt = MODE_PROMPTS["general"]
    try:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        if conv and hasattr(conv, "mode") and conv.mode in MODE_PROMPTS:
            system_prompt = MODE_PROMPTS[conv.mode]
    except Exception:
        pass

    history = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = [{"role": "system", "content": system_prompt}]
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


@router.post("/run-code", response_model=CodeRunResponse)
async def run_code_endpoint(
    body: CodeRunRequest,
    user: User = Depends(get_current_user),
):
    check_rate_limit(user.id)
    return await run_code(body.code, body.language)
