import type { Conversation, Message } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
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
    request<{ access_token: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { username: string; password: string }) =>
    request<{ access_token: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  googleLogin: (googleToken: string) =>
    request<{ access_token: string }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: googleToken }),
    }),

  phoneSendCode: (phone: string) =>
    request<{ message: string }>("/api/auth/phone/send", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  phoneVerify: (phone: string, code: string) =>
    request<{ access_token: string }>("/api/auth/phone/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),

  getDashboard: () => request<Record<string, unknown>>("/api/dashboard"),

  getConversations: () => request<Conversation[]>("/api/conversations"),

  createConversation: (title?: string) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title: title || "New Chat" }),
    }),

  getMessages: (convId: string) =>
    request<Message[]>(`/api/conversations/${convId}/messages`),

  deleteConversation: (convId: string) =>
    request<void>(`/api/conversations/${convId}`, { method: "DELETE" }),

  speechToText: (audio: string, mimeType: string) =>
    request<{ text: string }>("/api/speech-to-text", {
      method: "POST",
      body: JSON.stringify({ audio, mime_type: mimeType }),
    }),
};
