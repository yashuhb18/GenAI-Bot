"use client";
import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  BookOpen,
  PenLine,
  Code,
  GraduationCap,
  Search,
  ChevronDown,
} from "lucide-react";

export const MODES = [
  {
    id: "general",
    label: "General",
    icon: Sparkles,
    description: "Default AvenZa-AI mode",
    color: "text-[var(--accent)]",
  },
  {
    id: "explain",
    label: "Explain",
    icon: BookOpen,
    description: "Explain like I'm 12",
    color: "text-blue-500",
  },
  {
    id: "homework",
    label: "Homework",
    icon: PenLine,
    description: "Step-by-step solutions",
    color: "text-green-500",
  },
  {
    id: "code",
    label: "Code",
    icon: Code,
    description: "Production-quality code",
    color: "text-purple-500",
  },
  {
    id: "exam",
    label: "Exam Prep",
    icon: GraduationCap,
    description: "Practice questions & quiz",
    color: "text-orange-500",
  },
  {
    id: "research",
    label: "Research",
    icon: Search,
    description: "Structured analysis with citations",
    color: "text-cyan-500",
  },
];

interface Props {
  currentMode: string;
  onModeChange: (mode: string) => void;
}

export function ModeSelector({ currentMode, onModeChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeMode = MODES.find((m) => m.id === currentMode) || MODES[0];
  const Icon = activeMode.icon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border)]"
      >
        <Icon className={`w-3.5 h-3.5 ${activeMode.color}`} />
        <span className="text-[var(--text-secondary)] hidden sm:inline">
          {activeMode.label}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1.5 animate-fade-in">
          {MODES.map((mode) => {
            const ModeIcon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  onModeChange(mode.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors ${
                  currentMode === mode.id
                    ? "bg-[var(--bg-secondary)]"
                    : ""
                }`}
              >
                <ModeIcon className={`w-4 h-4 ${mode.color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {mode.label}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {mode.description}
                  </div>
                </div>
                {currentMode === mode.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
