# AI Chatbot — Full-Stack Architecture

## Project Structure

```
chatbot/
├── docker-compose.yml
├── .env.example
├── ARCHITECTURE.md
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial.py
│   └── app/
│       ├── __init__.py
│       ├── main.py                 # FastAPI app + CORS + lifespan
│       ├── config.py               # Pydantic Settings
│       ├── database.py             # SQLAlchemy engine + session
│       ├── models.py               # ORM models
│       ├── schemas.py              # Pydantic request/response
│       ├── auth.py                 # JWT utilities
│       ├── dependencies.py         # get_current_user, rate limiter
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py             # POST /register, /login
│       │   ├── conversations.py    # CRUD conversations
│       │   └── chat.py             # WebSocket + POST streaming
│       └── services/
│           ├── __init__.py
│           ├── ai.py               # OpenRouter streaming client
│           └── user.py             # User CRUD logic
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── public/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx          # Root layout + theme provider
│       │   ├── page.tsx            # Redirect to /chat or /login
│       │   ├── globals.css
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   └── chat/
│       │       └── page.tsx        # Main chat interface
│       ├── components/
│       │   ├── ui/                 # shadcn/ui primitives
│       │   ├── ChatMessage.tsx
│       │   ├── ChatInput.tsx
│       │   ├── ConversationSidebar.tsx
│       │   ├── ThemeToggle.tsx
│       │   └── AuthForm.tsx
│       ├── lib/
│       │   ├── api.ts              # fetch wrapper with JWT
│       │   ├── websocket.ts        # WebSocket manager
│       │   ├── auth.ts             # token storage + decode
│       │   └── utils.ts
│       ├── hooks/
│       │   ├── useChat.ts          # streaming chat hook
│       │   ├── useAuth.ts
│       │   └── useConversations.ts
│       └── types/
│           └── index.ts
│
└── tests/
    ├── conftest.py
    ├── test_auth.py
    ├── test_conversations.py
    └── test_chat.py
```

---

## 1. Backend Architecture

### 1.1 `backend/app/config.py` — Pydantic Settings

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://chatbot:chatbot@localhost:5432/chatbot"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-3.5-turbo"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env"}

settings = Settings()
```

### 1.2 `backend/app/database.py` — Async SQLAlchemy

```python
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session
```

### 1.3 `backend/app/models.py` — ORM Models

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))  # "user", "assistant", "system"
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
```

### 1.4 `backend/app/schemas.py` — Pydantic Models

```python
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ConversationCreate(BaseModel):
    title: str = "New Chat"

class ConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}

class ChatRequest(BaseModel):
    message: str
```

### 1.5 `backend/app/auth.py` — JWT Utilities

```python
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
```

### 1.6 `backend/app/dependencies.py` — Auth Dependency + Rate Limiter

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from collections import defaultdict
import time

from app.database import get_db
from app.auth import decode_access_token
from app.models import User

security = HTTPBearer()

# In-memory rate limiter (production: use Redis)
_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 20  # requests per minute
RATE_WINDOW = 60


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def check_rate_limit(user_id: str):
    now = time.time()
    _rate_limits[user_id] = [t for t in _rate_limits[user_id] if now - t < RATE_WINDOW]
    if len(_rate_limits[user_id]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    _rate_limits[user_id].append(now)
```

### 1.7 `backend/app/services/ai.py` — Streaming AI Client

```python
import httpx
from app.config import settings


async def stream_chat(messages: list[dict]):
    """Yields SSE chunks from OpenRouter. Used by both WebSocket and POST streaming."""
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            json={
                "model": settings.OPENROUTER_MODEL,
                "messages": messages,
                "stream": True,
            },
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    import json
                    data = json.loads(chunk)
                    delta = data["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
```

### 1.8 `backend/app/routers/chat.py` — WebSocket + REST Streaming

```python
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth import decode_access_token
from app.models import Conversation, Message
from app.services.ai import stream_chat
from app.dependencies import get_current_user, check_rate_limit
from app.schemas import ChatRequest

router = APIRouter()


# ── WebSocket endpoint ──────────────────────────────────────────
@router.websocket("/ws/chat/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str):
    await websocket.accept()

    # Authenticate via query param ?token=xxx
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

                # Load conversation history
                result = await db.execute(
                    select(Conversation).where(
                        Conversation.id == conversation_id,
                        Conversation.user_id == user_id,
                    )
                )
                conv = result.scalar_one_or_none()
                if not conv:
                    await websocket.send_text(json.dumps({"error": "Conversation not found"}))
                    continue

                # Save user message
                user_msg = Message(conversation_id=conversation_id, role="user", content=user_message)
                db.add(user_msg)
                await db.commit()

                # Build messages for AI
                history = await db.execute(
                    select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
                )
                ai_messages = [{"role": "system", "content": "You are a helpful assistant."}]
                for msg in history.scalars():
                    ai_messages.append({"role": msg.role, "content": msg.content})

                # Stream response
                full_response = []
                await websocket.send_text(json.dumps({"type": "start"}))
                async for chunk in stream_chat(ai_messages):
                    full_response.append(chunk)
                    await websocket.send_text(json.dumps({"type": "chunk", "content": chunk}))
                await websocket.send_text(json.dumps({"type": "end"}))

                # Save assistant message
                assistant_msg = Message(
                    conversation_id=conversation_id,
                    role="assistant",
                    content="".join(full_response),
                )
                db.add(assistant_msg)
                await db.commit()

        except WebSocketDisconnect:
            break
        except Exception as e:
            await websocket.send_text(json.dumps({"type": "error", "content": str(e)}))


# ── REST streaming (SSE fallback) ───────────────────────────────
from fastapi.responses import StreamingResponse

@router.post("/chat/{conversation_id}/stream")
async def rest_stream_chat(
    conversation_id: str,
    body: ChatRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    check_rate_limit(user.id)

    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = Message(conversation_id=conversation_id, role="user", content=body.message)
    db.add(user_msg)
    await db.commit()

    # Build history
    history = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    ai_messages = [{"role": "system", "content": "You are a helpful assistant."}]
    for msg in history.scalars():
        ai_messages.append({"role": msg.role, "content": msg.content})

    async def event_generator():
        full = []
        async for chunk in stream_chat(ai_messages):
            full.append(chunk)
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

        # Save after stream completes (using a new session)
        async with async_session() as save_db:
            save_db.add(Message(conversation_id=conversation_id, role="assistant", content="".join(full)))
            await save_db.commit()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### 1.9 `backend/app/routers/auth.py`

```python
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.schemas import UserRegister, UserLogin, TokenResponse
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where((User.email == body.email) | (User.username == body.username)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email or username already taken")
    user = User(email=body.email, username=body.username, hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(user.id))
```

### 1.10 `backend/app/routers/conversations.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Conversation, Message
from app.schemas import ConversationCreate, ConversationOut, MessageOut
from app.dependencies import get_current_user

router = APIRouter()


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(body: ConversationCreate, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    conv = Conversation(user_id=user.id, title=body.title)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/conversations/{conv_id}/messages", response_model=list[MessageOut])
async def get_messages(conv_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    msgs = await db.execute(
        select(Message).where(Message.conversation_id == conv_id).order_by(Message.created_at)
    )
    return msgs.scalars().all()


@router.delete("/conversations/{conv_id}", status_code=204)
async def delete_conversation(conv_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(conv)
    await db.commit()
```

### 1.11 `backend/app/main.py` — FastAPI Entry Point

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import auth, conversations, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="AI Chatbot API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(conversations.router, prefix="/api", tags=["Conversations"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

### 1.12 `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### 1.13 `backend/alembic/versions/001_initial.py`

```python
"""initial schema

Revision ID: 001
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), server_default="New Chat"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("conversation_id", sa.String(36), sa.ForeignKey("conversations.id"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("users")
```

---

## 2. Frontend Architecture

### 2.1 `frontend/src/types/index.ts`

```typescript
export interface User {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface StreamChunk {
  type: "start" | "chunk" | "end" | "error";
  content?: string;
}
```

### 2.2 `frontend/src/lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  register: (data: { email: string; username: string; password: string }) =>
    request<{ access_token: string }>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { username: string; password: string }) =>
    request<{ access_token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  getConversations: () => request<Conversation[]>("/api/conversations"),
  createConversation: (title?: string) =>
    request<Conversation>("/api/conversations", { method: "POST", body: JSON.stringify({ title: title || "New Chat" }) }),
  getMessages: (convId: string) => request<Message[]>(`/api/conversations/${convId}/messages`),
  deleteConversation: (convId: string) =>
    request<void>(`/api/conversations/${convId}`, { method: "DELETE" }),
};
```

### 2.3 `frontend/src/lib/websocket.ts`

```typescript
import { StreamChunk } from "@/types";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private onChunk: (chunk: StreamChunk) => void;
  private token: string;

  constructor(token: string, onChunk: (chunk: StreamChunk) => void) {
    this.token = token;
    this.onChunk = onChunk;
  }

  connect(conversationId: string) {
    this.ws = new WebSocket(`${WS_BASE}/api/ws/chat/${conversationId}?token=${this.token}`);
    this.ws.onmessage = (event) => {
      this.onChunk(JSON.parse(event.data));
    };
    this.ws.onerror = (event) => {
      this.onChunk({ type: "error", content: "Connection error" });
    };
  }

  send(content: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ content }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
```

### 2.4 `frontend/src/hooks/useChat.ts`

```typescript
"use client";
import { useState, useCallback, useRef } from "react";
import { ChatWebSocket } from "@/lib/websocket";
import { Message, StreamChunk } from "@/types";

export function useChat(conversationId: string | null, token: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const wsRef = useRef<ChatWebSocket | null>(null);

  const connect = useCallback((convId: string) => {
    wsRef.current?.disconnect();
    const ws = new ChatWebSocket(token, (chunk: StreamChunk) => {
      if (chunk.type === "start") {
        setIsStreaming(true);
        setStreamingContent("");
      } else if (chunk.type === "chunk") {
        setStreamingContent((prev) => prev + (chunk.content || ""));
      } else if (chunk.type === "end") {
        setIsStreaming(false);
        setStreamingContent("");
        // Reload messages to get the persisted one
      } else if (chunk.type === "error") {
        setIsStreaming(false);
      }
    });
    ws.connect(convId);
    wsRef.current = ws;
  }, [token]);

  const sendMessage = useCallback((content: string) => {
    if (!wsRef.current) return;

    // Optimistic UI
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content, created_at: new Date().toISOString() },
    ]);
    wsRef.current.send(content);
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
  }, []);

  return { messages, setMessages, isStreaming, streamingContent, connect, sendMessage, disconnect };
}
```

### 2.5 `frontend/src/components/ChatMessage.tsx`

```tsx
"use client";

interface Props {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: Props) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          role === "user"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {content}
          {isStreaming && <span className="animate-pulse ml-0.5">|</span>}
        </div>
      </div>
    </div>
  );
}
```

### 2.6 `frontend/src/components/ChatInput.tsx`

```tsx
"use client";
import { useState, useRef } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
      <div className="flex gap-3 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}}
          placeholder="Type a message..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none rounded-xl border dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

### 2.7 `frontend/src/components/ConversationSidebar.tsx`

```tsx
"use client";
import { Conversation } from "@/types";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <aside className="w-64 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col h-full">
      <div className="p-4">
        <button onClick={onNew} className="w-full rounded-lg border dark:border-gray-600 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          + New Chat
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer ${
              activeId === conv.id ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <span className="truncate">{conv.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

### 2.8 `frontend/src/app/chat/page.tsx` — Main Chat Page

```tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { Conversation } from "@/types";

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    setToken(t);
    api.getConversations().then(setConversations).catch(() => router.push("/login"));
  }, [router]);

  const { messages, setMessages, isStreaming, streamingContent, connect, sendMessage, disconnect } =
    useChat(activeConvId, token || "");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleNewChat = async () => {
    const conv = await api.createConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
    connect(conv.id);
    setMessages([]);
  };

  const handleSelectConv = async (id: string) => {
    disconnect();
    setActiveConvId(id);
    connect(id);
    const msgs = await api.getMessages(id);
    setMessages(msgs);
  };

  const handleDeleteConv = async (id: string) => {
    await api.deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); disconnect(); setMessages([]); }
  };

  if (!token) return null;

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConv}
        onNew={handleNewChat}
        onDelete={handleDeleteConv}
      />
      <main className="flex-1 flex flex-col">
        <header className="border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">AI Chat</h1>
          <button onClick={() => { localStorage.removeItem("token"); router.push("/login"); }} className="text-sm text-gray-500 hover:text-gray-700">
            Logout
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex items-center justify-center h-full text-gray-400">
              Start a new conversation
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isStreaming && streamingContent && (
            <ChatMessage role="assistant" content={streamingContent} isStreaming />
          )}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSend={sendMessage} disabled={isStreaming || !activeConvId} />
      </main>
    </div>
  );
}
```

### 2.9 `frontend/src/app/(auth)/login/page.tsx`

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { access_token } = await api.login(form);
      localStorage.setItem("token", access_token);
      router.push("/chat");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-bold text-center">Login</h1>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <input
          type="text" placeholder="Username" required
          value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="w-full rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password" placeholder="Password" required
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <p className="text-center text-sm text-gray-500">
          Don't have an account? <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
```

### 2.10 `frontend/next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://backend:8000/api/:path*" },
    ];
  },
};

export default nextConfig;
```

---

## 3. Docker Compose

### `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: chatbot
      POSTGRES_PASSWORD: chatbot
      POSTGRES_DB: chatbot
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatbot"]
      interval: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://chatbot:chatbot@db:5432/chatbot
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      NEXT_PUBLIC_WS_URL: ws://localhost:8000
    depends_on:
      - backend
    volumes:
      - ./frontend/src:/app/src

volumes:
  pgdata:
```

---

## 4. `.env.example` (root)

```
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_MODEL=openai/gpt-3.5-turbo
JWT_SECRET=your-super-secret-key-change-this
DATABASE_URL=postgresql+asyncpg://chatbot:chatbot@localhost:5432/chatbot
```

---

## 5. Implementation Steps (Build Order)

### Phase 1: Backend Foundation
1. Create `/backend` directory, `pyproject.toml` with deps: `fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `python-jose[cryptography]`, `passlib[bcrypt]`, `pydantic-settings`, `httpx`
2. Implement `config.py` → `database.py` → `models.py` → `schemas.py` → `auth.py`
3. Run Alembic init, generate migration, apply
4. Implement `routers/auth.py` (register/login)
5. Test with `uvicorn app.main:app` → verify at `/docs`

### Phase 2: Chat Backend
6. Implement `services/ai.py` — OpenRouter streaming client
7. Implement `routers/conversations.py` — CRUD
8. Implement `routers/chat.py` — WebSocket + SSE endpoints
9. Add `dependencies.py` — auth dependency + rate limiter

### Phase 3: Frontend
10. `npx create-next-app@latest frontend --typescript --tailwind --app`
11. Install `@radix-ui/react-*` for shadcn/ui (optional)
12. Build `types/index.ts` → `lib/api.ts` → `lib/websocket.ts`
13. Build `hooks/useChat.ts` → `hooks/useAuth.ts`
14. Build components: `ChatMessage`, `ChatInput`, `ConversationSidebar`, `AuthForm`
15. Build pages: `(auth)/login`, `(auth)/register`, `chat/page.tsx`
16. Add theme toggle (dark/light) with `next-themes`

### Phase 4: Docker & Polish
17. Write Dockerfiles for backend + frontend
18. Write `docker-compose.yml`
19. Add CORS, WebSocket upgrade handling
20. Add loading states, error boundaries, empty states
21. README with screenshots, setup instructions, architecture diagram

---

## 6. What Makes This Impressive to Recruiters

| Signal | Implementation |
|---|---|
| **Real-time systems** | WebSocket streaming with chunk-by-chunk rendering |
| **Security** | JWT auth, bcrypt hashing, CORS config, rate limiting |
| **Clean architecture** | routers / services / models / schemas separation |
| **Type safety** | TypeScript frontend, Pydantic backend, SQLAlchemy typed models |
| **Database design** | Proper foreign keys, indexes, cascade deletes, timestamps |
| **Async throughout** | async/await in FastAPI, asyncpg, httpx streaming |
| **DevOps** | Docker Compose, health checks, volume mounts |
| **API design** | RESTful + WebSocket, OpenAPI auto-docs at `/docs` |
| **Production patterns** | Error handling, optimistic UI, session management |
| **Code quality** | No comments, flat modules, consistent naming |
