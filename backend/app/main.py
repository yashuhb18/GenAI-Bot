from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, chat, conversations, speech


@asynccontextmanager
async def lifespan(_app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="AI Chatbot API",
    version="1.0.0",
    description="Full-stack AI chatbot with streaming WebSocket responses",
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
app.include_router(speech.router, prefix="/api", tags=["Speech"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
