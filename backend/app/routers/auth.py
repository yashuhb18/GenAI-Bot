import base64
import json
import random
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    GoogleLoginRequest,
    PhoneRequest,
    PhoneVerifyRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
)

router = APIRouter()

_phone_codes: dict[str, tuple[str, float]] = {}


def _normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit() or c == "+")
    if not digits.startswith("+"):
        digits = "+1" + digits
    return digits


@router.post("/register", response_model=TokenResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email or username already taken")
    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
    )
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


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = json.loads(
            base64.urlsafe_b64decode(body.google_token.split(".")[1] + "==")
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Google token")

    google_id = payload.get("sub")
    email = payload.get("email")
    name = payload.get("name", "")
    avatar = payload.get("picture")

    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Invalid Google token payload")

    result = await db.execute(
        select(User).where((User.google_id == google_id) | (User.email == email))
    )
    user = result.scalar_one_or_none()

    if user:
        if not user.google_id:
            user.google_id = google_id
            user.auth_provider = "google"
        if avatar:
            user.avatar_url = avatar
        await db.commit()
    else:
        username = name.replace(" ", "_").lower() or email.split("@")[0]
        base_username = username
        counter = 1
        while True:
            existing = await db.execute(select(User).where(User.username == username))
            if not existing.scalar_one_or_none():
                break
            username = f"{base_username}_{counter}"
            counter += 1

        user = User(
            email=email,
            username=username,
            auth_provider="google",
            google_id=google_id,
            avatar_url=avatar,
        )
        db.add(user)
        await db.commit()

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/phone/send")
async def send_phone_code(body: PhoneRequest):
    phone = _normalize_phone(body.phone)
    code = f"{random.randint(0, 999999):06d}"
    _phone_codes[phone] = (code, time.time() + 300)
    print(f"[DEV] Verification code for {phone}: {code}")
    return {"success": True, "message": "Verification code sent"}


@router.post("/phone/verify", response_model=TokenResponse)
async def verify_phone(body: PhoneVerifyRequest, db: AsyncSession = Depends(get_db)):
    phone = _normalize_phone(body.phone)
    stored = _phone_codes.get(phone)
    if not stored:
        raise HTTPException(status_code=400, detail="No verification code requested")
    code, expiry = stored
    if time.time() > expiry:
        del _phone_codes[phone]
        raise HTTPException(status_code=400, detail="Verification code expired")
    if code != body.code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    del _phone_codes[phone]

    result = await db.execute(select(User).where(User.phone_number == phone))
    user = result.scalar_one_or_none()

    if not user:
        username = f"user_{phone[-4:]}"
        base_username = username
        counter = 1
        while True:
            existing = await db.execute(select(User).where(User.username == username))
            if not existing.scalar_one_or_none():
                break
            username = f"{base_username}_{counter}"
            counter += 1

        user = User(
            email=f"{username}@phone.local",
            username=username,
            auth_provider="phone",
            phone_number=phone,
        )
        db.add(user)
        await db.commit()

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "auth_provider": user.auth_provider,
        "avatar_url": user.avatar_url,
        "phone_number": user.phone_number,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
