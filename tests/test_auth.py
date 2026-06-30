import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "username": "newuser", "password": "pass1234"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"email": "dup@example.com", "username": "dupuser", "password": "pass1234"},
    )
    resp = await client.post(
        "/api/auth/register",
        json={"email": "dup@example.com", "username": "dupuser", "password": "pass1234"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "username": "loginuser", "password": "pass1234"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"username": "loginuser", "password": "pass1234"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post(
        "/api/auth/register",
        json={"email": "wrong@example.com", "username": "wronguser", "password": "pass1234"},
    )
    resp = await client.post(
        "/api/auth/login",
        json={"username": "wronguser", "password": "wrongpass"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint(client: AsyncClient):
    resp = await client.get("/api/conversations")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_protected_with_token(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/conversations", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
