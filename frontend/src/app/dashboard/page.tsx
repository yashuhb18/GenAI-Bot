"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, removeToken } from "@/lib/auth";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Conversation } from "@/types";
import {
  MessageSquare,
  Hash,
  Calendar,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  ArrowRight,
  Plus,
  BookOpen,
} from "lucide-react";

interface DashboardUser {
  id: string;
  email: string;
  username: string;
  auth_provider: string;
  created_at?: string;
}

interface DashboardConversation {
  id: string;
  title: string;
  last_message: string;
  updated_at: string;
}

interface DashboardData {
  user: DashboardUser;
  recent_conversations: DashboardConversation[];
  total_conversations: number;
  total_messages: number;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);

    Promise.all([api.getDashboard(), api.getConversations()])
      .then(([dashData, convs]) => {
        setDashboard(dashData as unknown as DashboardData);
        setConversations(convs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  const handleNewChat = async () => {
    try {
      const conv = await api.createConversation();
      router.push(`/chat?id=${conv.id}`);
    } catch {
      removeToken();
      router.push("/login");
    }
  };

  const handleSelectConv = (id: string) => {
    router.push(`/chat?id=${id}`);
  };

  const handleDeleteConv = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              total_conversations: prev.total_conversations - 1,
              recent_conversations: prev.recent_conversations.filter(
                (c) => c.id !== id
              ),
            }
          : prev
      );
    } catch {
      // ignore
    }
  };

  if (!token || loading) {
    return (
      <div className="flex h-screen bg-[var(--bg-primary)] items-center justify-center">
        <div className="flex gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    );
  }

  const user = dashboard?.user;
  const recentConvs = dashboard?.recent_conversations || [];
  const totalConvs = dashboard?.total_conversations || 0;
  const totalMsgs = dashboard?.total_messages || 0;

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <div className="hidden md:block">
        <ConversationSidebar
          conversations={conversations}
          activeId={null}
          onSelect={handleSelectConv}
          onNew={handleNewChat}
          onDelete={handleDeleteConv}
          collapsed={false}
          currentPage="dashboard"
        />
      </div>

      {sidebarOpen && (
        <ConversationSidebar
          conversations={conversations}
          activeId={null}
          onSelect={handleSelectConv}
          onNew={handleNewChat}
          onDelete={handleDeleteConv}
          collapsed={false}
          onClose={() => setSidebarOpen(false)}
          currentPage="dashboard"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--border)]">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            title="Toggle sidebar"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5 text-[var(--text-secondary)]" />
            ) : (
              <PanelLeftOpen className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
          </button>

          <h1 className="text-sm font-semibold text-[var(--text-primary)]">
            Dashboard
          </h1>

          <div className="flex-1" />

          <ThemeToggle />

          {user && (
            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)]">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-[var(--text-primary)] hidden sm:inline">
                {user.username}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                    <MessageSquare className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                      {totalConvs}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                      Total Chats
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                    <Hash className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                      {totalMsgs}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                      Total Messages
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                    <Calendar className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                      {user?.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : "Member"}
                    </p>
                    <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                      Member Since
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center relative">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                      Online
                    </p>
                    <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                      Status
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleNewChat}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
              <button
                onClick={() => router.push("/chat")}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-hover)] active:scale-[0.98] transition-all"
              >
                View All Chats
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => router.push("/study")}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-hover)] active:scale-[0.98] transition-all"
              >
                <BookOpen className="w-4 h-4" />
                Study Planner
              </button>
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-3 sm:mb-4">
                Recent Conversations
              </h2>
              {recentConvs.length === 0 ? (
                <div className="text-center py-10 sm:py-12 rounded-xl border border-[var(--border)] border-dashed">
                  <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-tertiary)]">
                    No conversations yet. Start chatting!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentConvs.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleSelectConv(conv.id)}
                      className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] active:scale-[0.99] transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                            {conv.title}
                          </h3>
                          <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-1">
                            {conv.last_message
                              ? conv.last_message.length > 60
                                ? conv.last_message.slice(0, 60) + "..."
                                : conv.last_message
                              : "No messages yet"}
                          </p>
                        </div>
                        <span className="text-[10px] sm:text-xs text-[var(--text-tertiary)] shrink-0">
                          {timeAgo(conv.updated_at)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
