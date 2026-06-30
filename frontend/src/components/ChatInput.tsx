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
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 safe-area-inset">
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
                ? "Waiting for response..."
                : isListening
                  ? "Listening..."
                  : "Message..."
            }
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent px-3.5 sm:px-4 py-3 sm:py-3.5 text-[15px] sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-40 min-h-[48px] max-h-[200px]"
          />

          <div className="flex items-center gap-1 sm:gap-1.5 pr-2.5 sm:pr-3 pb-2.5 sm:pb-3">
            <button
              onClick={handleVoiceToggle}
              disabled={disabled}
              className={`w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all ${
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

            <button
              onClick={handleSubmit}
              disabled={disabled || !input.trim()}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

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
            <span className="text-[var(--text-tertiary)] hidden sm:inline">
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
