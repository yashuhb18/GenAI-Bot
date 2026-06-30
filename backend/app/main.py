from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routers import auth, bookmarks, chat, conversations, quiz, share, speech, study, upload


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
app.include_router(bookmarks.router, prefix="/api", tags=["Bookmarks"])
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(quiz.router, prefix="/api", tags=["Quiz"])
app.include_router(study.router, prefix="/api", tags=["Study"])
app.include_router(share.router, prefix="/api", tags=["Share"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(speech.router, prefix="/api", tags=["Speech"])

uploads_dir = Path(__file__).parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
