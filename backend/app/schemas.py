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


class GoogleLoginRequest(BaseModel):
    google_token: str


class PhoneRequest(BaseModel):
    phone: str


class PhoneVerifyRequest(BaseModel):
    phone: str
    code: str


class PhoneLoginRequest(BaseModel):
    phone: str
    code: str


class DashboardOut(BaseModel):
    recent_conversations: list[ConversationOut]
    total_conversations: int
    total_messages: int
    user_info: dict


class ChatRequest(BaseModel):
    message: str
