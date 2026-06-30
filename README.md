# GenAI-Bot

Full-stack AI chatbot with FastAPI backend, Next.js frontend, PostgreSQL database, JWT auth, WebSocket streaming, and voice input.

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy (async), PostgreSQL, JWT auth
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **AI**: OpenRouter API (DeepSeek V4 Flash)
- **Voice**: Groq Whisper (speech-to-text)

## Local Development

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in values
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

See `.env.example` for all required variables.

## Deployment

- **Frontend**: Vercel (auto-deploys from `main` branch)
- **Backend**: Render (auto-deploys from `main` branch)
- **Database**: Neon (PostgreSQL)
