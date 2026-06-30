"use client";
import { useEffect, useCallback } from "react";

interface ShortcutHandlers {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onFocusInput?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "k") {
        e.preventDefault();
        handlers.onFocusInput?.();
      }

      if (isMod && e.key === "n") {
        e.preventDefault();
        handlers.onNewChat?.();
      }

      if (isMod && e.shiftKey && e.key === "M") {
        e.preventDefault();
        handlers.onToggleSidebar?.();
      }

      if (isMod && e.key === "/") {
        e.preventDefault();
        handlers.onFocusInput?.();
      }

      if (e.key === "Escape") {
        handlers.onEscape?.();
      }
    },
    [handlers]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
