"use client";
import { useState } from "react";
import {
  GraduationCap,
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { api } from "@/lib/api";

interface QuizQuestion {
  question: string;
  type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

interface Props {
  conversationId: string;
  onClose: () => void;
}

export function QuizMode({ conversationId, onClose }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  const generateQuiz = async () => {
    setLoading(true);
    try {
      const data = await api.generateQuiz(conversationId, 5);
      setQuestions(data.questions);
      setCurrent(0);
      setScore(0);
      setFinished(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    if (showAnswer) return;
    setSelected(answer);
    setShowAnswer(true);
    if (answer === questions[current].correct_answer) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setShowAnswer(false);
    } else {
      setFinished(true);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <GraduationCap className="w-12 h-12 text-[var(--accent)] mx-auto mb-4 animate-pulse" />
          <p className="text-[var(--text-primary)] font-medium">Generating quiz questions...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <GraduationCap className="w-12 h-12 text-[var(--accent)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Quiz Mode
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Generate practice questions from this conversation.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generateQuiz}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors"
            >
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (finished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-[var(--bg-primary)] rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            Quiz Complete!
          </h3>
          <div className="text-4xl font-bold text-[var(--accent)] mb-2">
            {score}/{questions.length}
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {percentage}% correct
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-hover)] transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setQuestions([]);
                generateQuiz();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-[var(--bg-primary)] rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Question {current + 1} of {questions.length}
            </span>
          </div>
          <span className="text-sm font-medium text-[var(--accent)]">
            Score: {score}
          </span>
        </div>

        <div className="w-full h-1.5 bg-[var(--bg-secondary)] rounded-full mb-6">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>

        <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">
          {q.question}
        </h3>

        {q.type === "multiple_choice" && q.options.length > 0 && (
          <div className="space-y-2 mb-4">
            {q.options.map((option, i) => {
              const isCorrect = option === q.correct_answer;
              const isSelected = option === selected;
              let bg = "bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)]";
              if (showAnswer) {
                if (isCorrect) bg = "bg-green-100 dark:bg-green-900/30 border-green-500";
                else if (isSelected && !isCorrect) bg = "bg-red-100 dark:bg-red-900/30 border-red-500";
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(option)}
                  disabled={showAnswer}
                  className={`w-full text-left p-3 rounded-xl border border-[var(--border)] text-sm transition-all ${bg}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-tertiary)]">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <span className="text-[var(--text-primary)]">{option}</span>
                    {showAnswer && isCorrect && (
                      <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                    )}
                    {showAnswer && isSelected && !isCorrect && (
                      <XCircle className="w-4 h-4 text-red-500 ml-auto" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {q.type === "open_ended" && (
          <div className="mb-4">
            <input
              type="text"
              value={selected || ""}
              onChange={(e) => setSelected(e.target.value)}
              disabled={showAnswer}
              placeholder="Type your answer..."
              className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
            />
            {!showAnswer && (
              <button
                onClick={() => handleAnswer(selected || "")}
                disabled={!selected}
                className="mt-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
              >
                Submit
              </button>
            )}
          </div>
        )}

        {showAnswer && (
          <div className="p-3 rounded-xl bg-[var(--bg-secondary)] mb-4">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Answer:</span> {q.correct_answer}
            </p>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              {q.explanation}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-primary)] font-medium text-sm hover:bg-[var(--bg-hover)] transition-colors"
          >
            Exit
          </button>
          {showAnswer && (
            <button
              onClick={handleNext}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2"
            >
              {current < questions.length - 1 ? (
                <>
                  Next <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                "See Results"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
