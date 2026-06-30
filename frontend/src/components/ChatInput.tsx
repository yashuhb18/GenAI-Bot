"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Square, Loader2, Image, X } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { api } from "@/lib/api";

interface Props {
  onSend: (message: string, images?: string[]) => void;
  disabled?: boolean;
}

interface UploadedImage {
  url: string;
  preview: string;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput();

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newImages: UploadedImage[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) continue;

      setUploading(true);
      try {
        const result = await api.uploadFile(file);
        const preview = URL.createObjectURL(file);
        newImages.push({ url: result.url, preview });
      } catch {
        // ignore failed uploads
      } finally {
        setUploading(false);
      }
    }

    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        imageFiles.forEach((f) => dt.items.add(f));
        handleImageUpload(dt.files);
      }
    },
    [handleImageUpload]
  );

  const removeImage = (index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = () => {
    if ((!input.trim() && images.length === 0) || disabled) return;
    const imageUrls = images.map((img) => img.url);
    onSend(input.trim() || "What do you see in this image?", imageUrls.length > 0 ? imageUrls : undefined);
    setInput("");
    setImages([]);
    resetTranscript();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else if (!isSupported) {
      startListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleImageUpload(e.dataTransfer.files);
    },
    [handleImageUpload]
  );

  return (
    <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 safe-area-inset">
      <div className="max-w-3xl mx-auto">
        {images.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <div key={i} className="relative shrink-0 group">
                <img
                  src={img.preview}
                  alt="Upload"
                  className="w-16 h-16 rounded-lg object-cover border border-[var(--border)]"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className="relative flex items-end rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-[var(--shadow-md)] focus-within:border-[var(--accent)] focus-within:shadow-[var(--shadow-lg)] transition-all"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              disabled
                ? "Waiting for response..."
                : isListening
                  ? "Listening..."
                  : "Message... (paste images too)"
            }
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent px-3.5 sm:px-4 py-3 sm:py-3.5 text-[15px] sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none disabled:opacity-40 min-h-[48px] max-h-[200px]"
          />

          <div className="flex items-center gap-1 sm:gap-1.5 pr-2.5 sm:pr-3 pb-2.5 sm:pb-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Upload image"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Image className="w-4 h-4" />
              )}
            </button>

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
              disabled={disabled || (!input.trim() && images.length === 0)}
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
                style={{ animation: "pulse-dot 1s ease-in-out infinite" }}
              />
              <span
                className="w-1 h-3 rounded-full bg-[var(--accent)]"
                style={{ animation: "pulse-dot 1s ease-in-out infinite", animationDelay: "0.15s" }}
              />
              <span
                className="w-1 h-3 rounded-full bg-[var(--accent)]"
                style={{ animation: "pulse-dot 1s ease-in-out infinite", animationDelay: "0.3s" }}
              />
              <span
                className="w-1 h-3 rounded-full bg-[var(--accent)]"
                style={{ animation: "pulse-dot 1s ease-in-out infinite", animationDelay: "0.45s" }}
              />
            </span>
            <span>Listening... speak now</span>
            <span className="text-[var(--text-tertiary)] hidden sm:inline">| Press mic to stop</span>
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
