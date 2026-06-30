import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_conversation(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/conversations", json={"title": "Test Chat"}, headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Chat"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_conversations(client: AsyncClient, auth_headers: dict):
    await client.post("/api/conversations", json={"title": "Chat 1"}, headers=auth_headers)
    await client.post("/api/conversations", json={"title": "Chat 2"}, headers=auth_headers)
    resp = await client.get("/api/conversations", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_get_messages(client: AsyncClient, auth_headers: dict):
    conv = await client.post(
        "/api/conversations", json={"title": "Test"}, headers=auth_headers
    )
    conv_id = conv.json()["id"]
    resp = await client.get(f"/api/conversations/{conv_id}/messages", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_messages_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/conversations/nonexistent/messages", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_conversation(client: AsyncClient, auth_headers: dict):
    conv = await client.post(
        "/api/conversations", json={"title": "Delete Me"}, headers=auth_headers
    )
    conv_id = conv.json()["id"]
    resp = await client.delete(f"/api/conversations/{conv_id}", headers=auth_headers)
    assert resp.status_code == 204
    list_resp = await client.get("/api/conversations", headers=auth_headers)
    assert len(list_resp.json()) == 0


@pytest.mark.asyncio
async def test_delete_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete("/api/conversations/nonexistent", headers=auth_headers)
    assert resp.status_code == 404
