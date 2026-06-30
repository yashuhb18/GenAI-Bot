"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, removeToken } from "@/lib/auth";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Conversation } from "@/types";
import Link from "next/link";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Sparkles,
  Code,
  PenLine,
  Lightbulb,
  Globe,
  LayoutDashboard,
} from "lucide-react";

const SUGGESTIONS = [
  { icon: Code, label: "Explain async/await", prompt: "Explain how async/await works in Python with examples" },
  { icon: PenLine, label: "Write a poem", prompt: "Write a short poem about the beauty of code" },
  { icon: Lightbulb, label: "Brainstorm ideas", prompt: "Give me 5 creative project ideas for a developer portfolio" },
  { icon: Globe, label: "Summarize a topic", prompt: "Summarize the key concepts of REST API design" },
];

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
    api
      .getConversations()
      .then(setConversations)
      .catch(() => {
        removeToken();
        router.push("/login");
      });
  }, [router]);

  const refreshConversations = async () => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch {
      // ignore
    }
  };

  const {
    messages,
    isStreaming,
    streamingContent,
    connect,
    sendMessage,
    loadMessages,
    disconnect,
  } = useChat(token || "", refreshConversations);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleNewChat = async () => {
    try {
      const conv = await api.createConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      connect(conv.id);
    } catch {
      removeToken();
      router.push("/login");
    }
  };

  const handleSelectConv = async (id: string) => {
    disconnect();
    setActiveConvId(id);
    connect(id);
    try {
      const msgs = await api.getMessages(id);
      loadMessages(msgs);
    } catch {
      // ignore
    }
  };

  const handleDeleteConv = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        setActiveConvId(null);
        disconnect();
      }
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    removeToken();
    disconnect();
    router.push("/login");
  };

  const handleSuggestion = (prompt: string) => {
    if (!activeConvId) {
      handleNewChat().then(() => {
        setTimeout(() => sendMessage(prompt), 500);
      });
    } else {
      sendMessage(prompt);
    }
  };

  if (!token) return null;

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConv}
        onNew={handleNewChat}
        onDelete={handleDeleteConv}
        collapsed={sidebarCollapsed}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)]">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-[var(--text-secondary)]" />
            ) : (
              <PanelLeftClose className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="flex-1" />

          <ThemeToggle />

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full px-4 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center mb-6 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                How can I help you today?
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8">
                Ask me anything, or pick a suggestion below.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s.prompt)}
                    className="flex items-start gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] transition-all text-left group"
                  >
                    <s.icon className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-4">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
              ))}
              {isStreaming && streamingContent && (
                <ChatMessage role="assistant" content={streamingContent} isStreaming />
              )}
              {isStreaming && !streamingContent && (
                <div className="flex gap-4 px-4 py-5">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Assistant</span>
                    <div className="flex gap-1.5 py-3">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming || !activeConvId}
        />
      </main>
    </div>
  );
}
