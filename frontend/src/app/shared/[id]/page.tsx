"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import { Bot, User, Sparkles, Link2 } from "lucide-react";

interface Message {
  role: string;
  content: string;
}

interface SharedData {
  title: string;
  mode: string;
  messages: Message[];
}

export default function SharedPage() {
  const params = useParams();
  const shareId = params.id as string;
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shareId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/shared/${shareId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Share link not found or expired"))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <Link2 className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {error || "Not found"}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            This share link may have expired or been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            AvenZa-AI
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">|</span>
          <span className="text-sm text-[var(--text-secondary)] truncate">
            {data.title}
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
        {data.messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 px-4 py-3 ${
              msg.role === "user" ? "justify-end" : ""
            }`}
          >
            {msg.role !== "user" && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white rounded-br-md"
                  : "text-[var(--text-primary)]"
              }`}
            >
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              ) : (
                <div className="prose-chat text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeRaw]}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
