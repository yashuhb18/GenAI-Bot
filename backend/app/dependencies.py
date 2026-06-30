import time
from collections import defaultdict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_access_token
from app.database import get_db
from app.models import User

security = HTTPBearer()

_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT = 20
RATE_WINDOW = 60


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    print(f"[AUTH] Token received, length: {len(token)}, starts with: {token[:20]}...")
    user_id = decode_access_token(token)
    print(f"[AUTH] Decoded user_id: {user_id}")
    if not user_id:
        print("[AUTH] Invalid token!")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        print(f"[AUTH] User not found for id: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    print(f"[AUTH] Authenticated: {user.username}")
    return user


def check_rate_limit(user_id: str) -> None:
    now = time.time()
    _rate_limits[user_id] = [t for t in _rate_limits[user_id] if now - t < RATE_WINDOW]
    if len(_rate_limits[user_id]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    _rate_limits[user_id].append(now)
