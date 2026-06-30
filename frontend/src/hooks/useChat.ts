"use client";
import { useCallback, useRef, useState } from "react";
import { ChatWebSocket } from "@/lib/websocket";
import type { Message, StreamChunk } from "@/types";

export function useChat(token: string, onStreamEnd?: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const streamingRef = useRef("");
  const wsRef = useRef<ChatWebSocket | null>(null);

  const connect = useCallback(
    (conversationId: string) => {
      wsRef.current?.disconnect();
      setMessages([]);
      streamingRef.current = "";
      const ws = new ChatWebSocket(token, (chunk: StreamChunk) => {
        if (chunk.type === "start") {
          setIsStreaming(true);
          setStreamingContent("");
          streamingRef.current = "";
        } else if (chunk.type === "chunk") {
          const text = chunk.content || "";
          streamingRef.current += text;
          setStreamingContent(streamingRef.current);
        } else if (chunk.type === "end") {
          const fullContent = streamingRef.current;
          setIsStreaming(false);
          setStreamingContent("");
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
          onStreamEnd?.();
        } else if (chunk.type === "error") {
          setIsStreaming(false);
          setStreamingContent("");
        }
      });
      ws.connect(conversationId);
      wsRef.current = ws;
    },
    [token]
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          created_at: new Date().toISOString(),
        },
      ]);
      wsRef.current.send(content);
    },
    []
  );

  const loadMessages = useCallback((msgs: Message[]) => {
    setMessages(msgs);
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
    wsRef.current = null;
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
