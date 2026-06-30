"use client";
import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { Bot, User, Copy, Check } from "lucide-react";

interface Props {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)] transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLPreElement>) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-[var(--border)]">
      {language && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-tertiary)] border-b border-[var(--border)]">
          <span className="text-xs font-mono text-[var(--text-tertiary)]">{language}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!language && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={code} />
        </div>
      )}
      <pre className={`bg-[#0d1117] ${language ? '' : 'pt-4'} px-4 py-3 overflow-x-auto`}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function ChatMessage({ role, content, isStreaming }: Props) {
  const isUser = role === "user";

  return (
    <div className={`animate-fade-in flex gap-4 px-4 py-5 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isUser ? "max-w-[75%]" : "max-w-[80%] min-w-0"}`}>
        {!isUser && (
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Assistant</span>
        )}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-[var(--accent)] text-white rounded-br-md"
              : "text-[var(--text-primary)]"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={{
                  pre: CodeBlock,
                }}
              >
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-[var(--accent)] animate-pulse rounded-sm" />
              )}
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
          <User className="w-4 h-4 text-[var(--text-secondary)]" />
        </div>
      )}
    </div>
  );
}
