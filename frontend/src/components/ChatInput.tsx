"use client";
import { useRef, useState, useEffect } from "react";
import { Send, Mic, MicOff, Square, Loader2 } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput();

  // Sync transcript to input
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput("");
    resetTranscript();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else if (!isSupported) {
      // Error will be set by the hook if MediaRecorder fails
      startListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-[var(--shadow-md)] focus-within:border-[var(--accent)] focus-within:shadow-[var(--shadow-lg)] transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              disabled
                ? "Select or start a new chat..."
                : isListening
                  ? "Listening..."
                  : "Message..."
            }
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-40 min-h-[48px] max-h-[200px]"
          />

          <div className="flex items-center gap-1.5 pr-3 pb-3">
            {/* Voice Input Button */}
            <button
              onClick={handleVoiceToggle}
              disabled={disabled}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                isListening
                  ? "bg-red-500 text-white animate-pulse hover:bg-red-600"
                  : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title={isListening ? "Stop recording" : "Voice input"}
            >
              {isListening ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Send Button */}
            <button
              onClick={handleSubmit}
              disabled={disabled || !input.trim()}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Voice Status / Error */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-[var(--accent)]">
            <span className="flex gap-0.5">
              <span
                className="w-1 h-3 rounded-full bg-[var(--accent)]"
                style={{
                  animation: "pulse-dot 1s ease-in-out infinite",
                  animationDelay: "0s",
                }}
              />
              <span
                className="w-1 h-3 rounded-full bg-[var(--accent)]"
                style={{
                  animation: "pulse-dot 1s ease-in-out infinite",
                  animationDelay: "0.15s",
                }}
              />
              <span
                className="w-1 h-3 rounded-full bg-[var(--accent)]"
                style={{
                  animation: "pulse-dot 1s ease-in-out infinite",
                  animationDelay: "0.3s",
                }}
              />
              <span
                className="w-1 h-3 rounded-full bg-[var(--accent)]"
                style={{
                  animation: "pulse-dot 1s ease-in-out infinite",
                  animationDelay: "0.45s",
                }}
              />
            </span>
            <span>Listening... speak now</span>
            <span className="text-[var(--text-tertiary)]">|</span>
            <span className="text-[var(--text-tertiary)]">
              Press mic to stop
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-red-500">
            <MicOff className="w-3 h-3" />
            <span>{error}</span>
          </div>
        )}

        {!isListening && !error && (
          <p className="text-center text-xs text-[var(--text-tertiary)] mt-2">
            AI can make mistakes. Check important info.
          </p>
        )}
      </div>
    </div>
  );
}
