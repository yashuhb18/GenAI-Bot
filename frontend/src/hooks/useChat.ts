"use client";
import { useCallback, useRef, useState } from "react";
import type { Message } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useChat(token: string, onStreamEnd?: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const streamingRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback(
    (_conversationId: string) => {
      return Promise.resolve();
    },
    [token]
  );

  const sendMessage = useCallback(
    async (content: string, conversationId?: string) => {
      if (!conversationId || isStreaming) return;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          created_at: new Date().toISOString(),
        },
      ]);

      setIsStreaming(true);
      setStreamingContent("");
      streamingRef.current = "";

      try {
        abortRef.current = new AbortController();
        const res = await fetch(
          `${API_BASE}/api/chat/${conversationId}/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ message: content }),
            signal: abortRef.current.signal,
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Request failed" }));
          throw new Error(err.detail || "Request failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                streamingRef.current += parsed.content;
                setStreamingContent(streamingRef.current);
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        const fullContent = streamingRef.current;
        if (fullContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: fullContent,
              created_at: new Date().toISOString(),
            },
          ]);
        }
        streamingRef.current = "";
        setStreamingContent("");
        setIsStreaming(false);
        onStreamEnd?.();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // user cancelled
        } else {
          console.error("[STREAM] Error:", err);
        }
        setStreamingContent("");
        setIsStreaming(false);
      }
    },
    [token, isStreaming, onStreamEnd]
  );

  const loadMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
  }, []);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    connect,
    sendMessage,
    loadMessages,
    disconnect,
  };
}
