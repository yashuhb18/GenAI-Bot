import type { StreamChunk } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private onChunk: (chunk: StreamChunk) => void;
  private token: string;

  constructor(token: string, onChunk: (chunk: StreamChunk) => void) {
    this.token = token;
    this.onChunk = onChunk;
  }

  connect(conversationId: string): Promise<void> {
    this.disconnect();
    return new Promise((resolve) => {
      const url = `${WS_BASE}/api/ws/chat/${conversationId}?token=${this.token}`;
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        console.log("[WS] Connected to", url.substring(0, 60));
        resolve();
      };
      this.ws.onmessage = (event) => {
        this.onChunk(JSON.parse(event.data));
      };
      this.ws.onerror = (e) => {
        console.error("[WS] Error:", e);
        this.onChunk({ type: "error", content: "Connection error" });
        resolve();
      };
      this.ws.onclose = (e) => {
        console.log("[WS] Closed:", e.code, e.reason);
      };
    });
  }

  send(content: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ content }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}
