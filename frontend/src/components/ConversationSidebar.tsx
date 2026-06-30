"use client";
import type { Conversation } from "@/types";
import {
  MessageSquarePlus,
  Trash2,
  MessageSquare,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  collapsed?: boolean;
  onClose?: () => void;
  currentPage?: "chat" | "dashboard";
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  collapsed,
  onClose,
  currentPage = "chat",
}: Props) {
  if (collapsed) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[var(--bg-secondary)] flex flex-col h-full border-r border-[var(--border)] md:relative md:z-auto md:w-[var(--sidebar-width)]">
        <div className="p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className={`flex-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                currentPage === "dashboard"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <button
              onClick={onClose}
              className="ml-2 p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] md:hidden"
            >
              ✕
            </button>
          </div>
          <button
            onClick={onNew}
            className="w-full flex items-center gap-2.5 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <div className="px-2 py-1.5 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            Recent
          </div>
          <nav className="space-y-0.5">
            {conversations.length === 0 && (
              <p className="text-xs text-[var(--text-tertiary)] px-2 py-3 text-center">
                No conversations yet
              </p>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  onSelect(conv.id);
                  onClose?.();
                }}
                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                  activeId === conv.id
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-50" />
                <span className="truncate flex-1">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-tertiary)] hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </nav>
        </div>

        <div className="p-3 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">
            Powered by OpenRouter
          </div>
        </div>
      </aside>
    </>
  );
}
