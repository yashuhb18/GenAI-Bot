"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getToken, removeToken } from "@/lib/auth";
import { ConversationSidebar } from "@/components/ConversationSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Conversation } from "@/types";
import {
  BookOpen,
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  ArrowLeft,
  Sparkles,
  Loader2,
} from "lucide-react";

interface DailyPlan {
  day: number;
  topic: string;
  key_concepts: string[];
  estimated_time_minutes: number;
  practice_tasks: string[];
  completed: boolean;
}

interface StudyPlan {
  title: string;
  total_days: number;
  daily_plans: DailyPlan[];
}

export default function StudyPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [topic, setTopic] = useState("");
  const [days, setDays] = useState(7);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const data = await api.generateStudyPlan(topic, days);
      setPlan(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (dayIdx: number, taskIdx: number) => {
    const key = `${dayIdx}-${taskIdx}`;
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getDayProgress = (dayIdx: number) => {
    if (!plan) return 0;
    const tasks = plan.daily_plans[dayIdx].practice_tasks;
    const completed = tasks.filter((_, i) => completedTasks.has(`${dayIdx}-${i}`)).length;
    return tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  };

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <div className="hidden md:block">
        <ConversationSidebar
          conversations={conversations}
          activeId={null}
          onSelect={(id) => router.push(`/chat?id=${id}`)}
          onNew={() => router.push("/chat")}
          onDelete={() => {}}
          collapsed={false}
        />
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
          <button
            onClick={() => router.push("/chat")}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <BookOpen className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">
            Study Planner
          </h1>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            {!plan ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-[var(--accent)] mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    Create a Study Plan
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Enter a topic and get a structured day-by-day study plan.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                      Topic
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Organic Chemistry, React Hooks, Machine Learning..."
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                      Number of Days
                    </label>
                    <div className="flex gap-2">
                      {[3, 5, 7, 14, 30].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDays(d)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            days === d
                              ? "bg-[var(--accent)] text-white"
                              : "border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={loading || !topic.trim()}
                    className="w-full rounded-xl bg-[var(--accent)] py-3 text-white font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {loading ? "Generating..." : "Generate Study Plan"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      {plan.title}
                    </h2>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {plan.total_days} days
                    </p>
                  </div>
                  <button
                    onClick={() => setPlan(null)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    New Plan
                  </button>
                </div>

                {plan.daily_plans.map((day, dayIdx) => {
                  const progress = getDayProgress(dayIdx);
                  return (
                    <div
                      key={dayIdx}
                      className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden"
                    >
                      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border)]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-sm font-bold text-[var(--accent)]">
                            {day.day}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-[var(--text-primary)]">
                              {day.topic}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock className="w-3 h-3 text-[var(--text-tertiary)]" />
                              <span className="text-xs text-[var(--text-tertiary)]">
                                {day.estimated_time_minutes} min
                              </span>
                            </div>
                          </div>
                        </div>
                        {progress === 100 && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>

                      <div className="px-4 py-3 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
                            Key Concepts
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {day.key_concepts.map((concept, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-[var(--bg-secondary)] text-xs text-[var(--text-secondary)]"
                              >
                                {concept}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
                            Practice Tasks
                          </p>
                          <div className="space-y-1.5">
                            {day.practice_tasks.map((task, taskIdx) => {
                              const key = `${dayIdx}-${taskIdx}`;
                              const done = completedTasks.has(key);
                              return (
                                <button
                                  key={taskIdx}
                                  onClick={() => toggleTask(dayIdx, taskIdx)}
                                  className="w-full flex items-start gap-2 text-left p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                                >
                                  {done ? (
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                                  )}
                                  <span
                                    className={`text-sm ${
                                      done
                                        ? "text-[var(--text-tertiary)] line-through"
                                        : "text-[var(--text-primary)]"
                                    }`}
                                  >
                                    {task}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
