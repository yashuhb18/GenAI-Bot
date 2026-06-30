"use client";
import { useState } from "react";
import { Play, Loader2, CheckCircle, XCircle, Copy, Check } from "lucide-react";

interface Props {
  code: string;
  language: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  bash: "bash",
  sh: "bash",
  shell: "bash",
};

export function CodeRunner({ code, language }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    output: string;
    error: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const lang = LANGUAGE_MAP[language.toLowerCase()] || language.toLowerCase();
  const isSupported = ["python", "javascript", "typescript", "bash", "shell"].includes(lang);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/run-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
          body: JSON.stringify({ code, language: lang }),
        }
      );
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        output: "",
        error: err instanceof Error ? err.message : "Failed to run code",
      });
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isSupported) return null;

  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-600/10 text-green-600 hover:bg-green-600/20 disabled:opacity-50 transition-colors"
        >
          {running ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          {running ? "Running..." : "Run"}
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-2 rounded-lg border text-xs font-mono ${
            result.success
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-inherit">
            {result.success ? (
              <CheckCircle className="w-3 h-3 text-green-600" />
            ) : (
              <XCircle className="w-3 h-3 text-red-600" />
            )}
            <span
              className={
                result.success
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }
            >
              {result.success ? "Output" : "Error"}
            </span>
          </div>
          <pre className="px-3 py-2 overflow-x-auto whitespace-pre-wrap">
            <span className={result.success ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}>
              {result.success ? result.output || "(no output)" : result.error}
            </span>
          </pre>
        </div>
      )}
    </div>
  );
}
