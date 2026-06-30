"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, removeToken } from "@/lib/auth";
import { useChat } from "@/hooks/useChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModeSelector } from "@/components/ModeSelector";
import { QuickActions } from "@/components/QuickActions";
import { QuizMode } from "@/components/QuizMode";
import type { Conversation, Bookmark } from "@/types";
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
  Menu,
  Download,
  GraduationCap,
  Share2,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState("general");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [quizOpen, setQuizOpen] = useState(false);
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
      .catch(() => {});
    api.getBookmarks().then(setBookmarks).catch(() => {});
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

  useKeyboardShortcuts({
    onNewChat: () => handleNewChat(),
    onToggleSidebar: () => setSidebarOpen((o) => !o),
    onFocusInput: () => {
      const input = document.querySelector("textarea");
      input?.focus();
    },
    onEscape: () => setSidebarOpen(false),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleNewChat = async (mode?: string) => {
    try {
      const conv = await api.createConversation(undefined, mode || currentMode);
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
      setCurrentMode(conv.mode);
      connect(conv.id);
      setSidebarOpen(false);
    } catch {
      removeToken();
      router.push("/login");
    }
  };

  const handleSelectConv = async (id: string) => {
    disconnect();
    setActiveConvId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv) setCurrentMode(conv.mode || "general");
    connect(id);
    setSidebarOpen(false);
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

  const handleExport = async () => {
    if (!activeConvId) return;
    try {
      await api.exportConversation(activeConvId);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!activeConvId) return;
    try {
      const { share_url } = await api.shareConversation(activeConvId);
      const fullUrl = `${window.location.origin}${share_url}`;
      await navigator.clipboard.writeText(fullUrl);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    removeToken();
    disconnect();
    router.push("/login");
  };

  const handleSuggestion = async (prompt: string) => {
    if (!activeConvId) {
      try {
        const conv = await api.createConversation(undefined, currentMode);
        setConversations((prev) => [conv, ...prev]);
        setActiveConvId(conv.id);
        await connect(conv.id);
        sendMessage(prompt);
      } catch {
        removeToken();
        router.push("/login");
      }
    } else {
      sendMessage(prompt);
    }
  };

  const handleModeChange = async (mode: string) => {
    setCurrentMode(mode);
    if (activeConvId) {
      try {
        await api.updateConversationMode(activeConvId, mode);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? { ...c, mode } : c))
        );
      } catch {
        // ignore
      }
    }
  };

  const handleBookmark = async (messageId: string) => {
    if (!activeConvId) return;
    const existing = bookmarks.find((b) => b.message_id === messageId);
    if (existing) {
      try {
        await api.removeBookmark(existing.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
      } catch {
        // ignore
      }
    } else {
      try {
        const bm = await api.addBookmark(activeConvId, messageId);
        setBookmarks((prev) => [bm, ...prev]);
      } catch {
        // ignore
      }
    }
  };

  const handleSend = async (content: string, images?: string[]) => {
    const message = images && images.length > 0
      ? `${content}\n\n[Images: ${images.join(", ")}]`
      : content;

    if (!activeConvId) {
      try {
        const conv = await api.createConversation(undefined, currentMode);
        setConversations((prev) => [conv, ...prev]);
        setActiveConvId(conv.id);
        await connect(conv.id);
        sendMessage(message);
      } catch {
        removeToken();
        router.push("/login");
      }
    } else {
      sendMessage(message);
    }
  };

  if (!token) return null;

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <div className="hidden md:block">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConv}
          onNew={handleNewChat}
          onDelete={handleDeleteConv}
          collapsed={false}
        />
      </div>

      {sidebarOpen && (
        <ConversationSidebar
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConv}
          onNew={handleNewChat}
          onDelete={handleDeleteConv}
          collapsed={false}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--border)] bg-[var(--bg-primary)] shadow-[0_1px_3px_rgba(0,0,0,0.1)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors md:hidden active:scale-95"
          >
            <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors hidden md:block"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5 text-[var(--text-secondary)]" />
            ) : (
              <PanelLeftOpen className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
          </button>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="flex-1" />

          <span className="text-sm font-semibold text-[var(--text-primary)] sm:hidden">AvenZa-AI</span>

          {activeConvId && (
            <ModeSelector currentMode={currentMode} onModeChange={handleModeChange} />
          )}

          {activeConvId && (
            <button
              onClick={handleExport}
              className="p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              title="Export conversation"
            >
              <Download className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          )}

          {activeConvId && (
            <button
              onClick={handleShare}
              className="p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              title="Share conversation"
            >
              <Share2 className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          )}

          {activeConvId && (
            <button
              onClick={() => setQuizOpen(true)}
              className="p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              title="Start quiz"
            >
              <GraduationCap className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          )}

          <ThemeToggle />

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full px-4 animate-fade-in">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center mb-4 sm:mb-6 shadow-lg">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] mb-2 text-center">
                How can I help you today?
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6 sm:mb-8 text-center max-w-xs">
                Ask me anything, or pick a suggestion below.
              </p>

              <div className="grid grid-cols-1 gap-3 w-full max-w-sm sm:max-w-lg sm:grid-cols-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s.prompt)}
                    className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] active:scale-[0.98] transition-all text-left group min-h-[56px]"
                  >
                    <s.icon className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors leading-snug">
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-3 sm:py-4 px-3 sm:px-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  messageId={msg.id}
                  conversationId={activeConvId || undefined}
                  isBookmarked={bookmarks.some((b) => b.message_id === msg.id)}
                  onBookmark={msg.role === "assistant" ? handleBookmark : undefined}
                />
              ))}
              {isStreaming && streamingContent && (
                <ChatMessage role="assistant" content={streamingContent} isStreaming />
              )}
              {isStreaming && !streamingContent && (
                <div className="flex gap-3 sm:gap-4 px-3 sm:px-4 py-4 sm:py-5">
                  <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[var(--accent)] flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
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
              {!isStreaming && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                <div className="mt-2 mb-4">
                  <QuickActions onAction={handleSend} disabled={isStreaming} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
        />
      </main>

      {quizOpen && activeConvId && (
        <QuizMode
          conversationId={activeConvId}
          onClose={() => setQuizOpen(false)}
        />
      )}
    </div>
  );
}
