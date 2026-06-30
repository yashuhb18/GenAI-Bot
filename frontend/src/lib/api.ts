import type { Bookmark, Conversation, Message, QuizQuestion, StudyPlan } from "@/types";

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

  searchConversations: (q: string) =>
    request<Conversation[]>(`/api/conversations/search?q=${encodeURIComponent(q)}`),

  createConversation: (title?: string, mode?: string) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title: title || "New Chat", mode: mode || "general" }),
    }),

  updateConversationMode: (convId: string, mode: string) =>
    request<Conversation>(`/api/conversations/${convId}/mode`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  getMessages: (convId: string) =>
    request<Message[]>(`/api/conversations/${convId}/messages`),

  deleteConversation: (convId: string) =>
    request<void>(`/api/conversations/${convId}`, { method: "DELETE" }),

  shareConversation: (convId: string) =>
    request<{ share_id: string; share_url: string }>(`/api/conversations/${convId}/share`, {
      method: "POST",
    }),

  getSharedConversation: (shareId: string) =>
    request<{ title: string; mode: string; messages: Array<{ role: string; content: string }> }>(
      `/api/shared/${shareId}`
    ),

  exportConversation: async (convId: string, format: string = "markdown") => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(
      `${API_BASE}/api/conversations/${convId}/export?fmt=${format}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
    const filename = filenameMatch ? filenameMatch[1] : `conversation.${format === "markdown" ? "md" : format}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  speechToText: (audio: string, mimeType: string) =>
    request<{ text: string }>("/api/speech-to-text", {
      method: "POST",
      body: JSON.stringify({ audio, mime_type: mimeType }),
    }),

  getBookmarks: () => request<Bookmark[]>("/api/bookmarks"),

  addBookmark: (conversationId: string, messageId: string, note?: string) =>
    request<Bookmark>("/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, message_id: messageId, note }),
    }),

  removeBookmark: (bookmarkId: string) =>
    request<void>(`/api/bookmarks/${bookmarkId}`, { method: "DELETE" }),

  generateQuiz: (conversationId: string, numQuestions: number = 5) =>
    request<{ questions: QuizQuestion[] }>("/api/quiz", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, num_questions: numQuestions }),
    }),

  generateStudyPlan: (topic: string, days: number = 7, conversationId?: string) =>
    request<StudyPlan>("/api/study-plan", {
      method: "POST",
      body: JSON.stringify({ topic, days, conversation_id: conversationId }),
    }),

  uploadFile: async (file: File) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json() as Promise<{ url: string; filename: string; content_type: string; size: number }>;
  },
};
