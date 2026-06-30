"use client";
import {
  Lightbulb,
  Code,
  PenLine,
  GraduationCap,
  ArrowDown,
  Sparkles,
} from "lucide-react";

interface Props {
  onAction: (prompt: string) => void;
  disabled?: boolean;
}

const QUICK_ACTIONS = [
  {
    label: "Explain further",
    prompt: "Explain this in more detail",
    icon: Lightbulb,
    color: "text-blue-500",
  },
  {
    label: "Give example",
    prompt: "Give me a practical example",
    icon: PenLine,
    color: "text-green-500",
  },
  {
    label: "Simpler",
    prompt: "Explain this in simpler terms",
    icon: ArrowDown,
    color: "text-orange-500",
  },
  {
    label: "Write code",
    prompt: "Write code for this",
    icon: Code,
    color: "text-purple-500",
  },
  {
    label: "Practice questions",
    prompt: "Generate practice questions on this topic",
    icon: GraduationCap,
    color: "text-cyan-500",
  },
  {
    label: "Quiz me",
    prompt: "Quiz me on what we just discussed",
    icon: Sparkles,
    color: "text-pink-500",
  },
];

export function QuickActions({ onAction, disabled }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 px-3 sm:px-4 animate-fade-in">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => onAction(action.prompt)}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-primary)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-all shrink-0"
          >
            <Icon className={`w-3.5 h-3.5 ${action.color}`} />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
