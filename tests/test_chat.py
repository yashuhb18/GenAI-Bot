import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_rest_stream_requires_auth(client: AsyncClient):
    conv_resp = await client.post(
        "/api/auth/register",
        json={"email": "chat@example.com", "username": "chatuser", "password": "pass1234"},
    )
    token = conv_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    conv = await client.post(
        "/api/conversations", json={"title": "Stream Test"}, headers=headers
    )
    conv_id = conv.json()["id"]

    no_auth_resp = await client.post(
        f"/api/chat/{conv_id}/stream",
        json={"message": "Hello"},
    )
    assert no_auth_resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_rest_stream_conversation_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/chat/nonexistent/stream",
        json={"message": "Hello"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
