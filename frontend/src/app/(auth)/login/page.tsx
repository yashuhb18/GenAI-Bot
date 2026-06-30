"use client";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <AuthForm mode="login" />
      </div>
    </div>
  );
}
