"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Bot, Loader2, Mail, Phone, ChevronDown } from "lucide-react";

type Tab = "email" | "phone" | "google";

interface Props {
  mode: "login" | "register";
}

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const COUNTRIES = [
  { code: "+91", label: "IN", name: "India" },
  { code: "+1", label: "US", name: "United States" },
  { code: "+44", label: "UK", name: "United Kingdom" },
  { code: "+61", label: "AU", name: "Australia" },
  { code: "+971", label: "AE", name: "UAE" },
  { code: "+65", label: "SG", name: "Singapore" },
];

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [phoneStep, setPhoneStep] = useState<"input" | "verify">("input");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const googleScriptRef = useRef<HTMLScriptElement | null>(null);

  const onSuccess = useCallback(
    (token: string) => {
      setToken(token);
      router.push("/chat");
    },
    [router],
  );

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        const { access_token } = await api.register({
          email,
          username,
          password,
        });
        onSuccess(access_token);
      } else {
        const { access_token } = await api.login({ username, password });
        onSuccess(access_token);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSend = async () => {
    setError("");
    setPhoneLoading(true);
    try {
      const raw = phone.replace(/\D/g, "");
      const full = `${countryCode}${raw}`;
      await api.phoneSendCode(full);
      setPhoneStep("verify");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handlePhoneVerify = async () => {
    setError("");
    setPhoneLoading(true);
    try {
      const raw = phone.replace(/\D/g, "");
      const full = `${countryCode}${raw}`;
      const { access_token } = await api.phoneVerify(full, phoneCode);
      onSuccess(access_token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleGoogleClick = useCallback(() => {
    setError("");
    setLoading(true);

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

    if (!clientId || clientId === "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com") {
      setError("Google login is not configured yet. Please use email or phone login.");
      setLoading(false);
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            const { access_token } = await api.googleLogin(response.credential);
            onSuccess(access_token);
          } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Google login failed");
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.prompt();
      setLoading(false);
      return;
    }

    if (!googleScriptRef.current) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: { credential: string }) => {
              try {
                const { access_token } = await api.googleLogin(response.credential);
                onSuccess(access_token);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Google login failed");
                setLoading(false);
              }
            },
          });
          window.google.accounts.id.prompt();
        }
        setLoading(false);
      };
      script.onerror = () => {
        setError("Failed to load Google SDK");
        setLoading(false);
      };
      document.head.appendChild(script);
      googleScriptRef.current = script;
    }
  }, [onSuccess]);

  useEffect(() => {
    return () => {
      if (googleScriptRef.current) {
        googleScriptRef.current.remove();
        googleScriptRef.current = null;
      }
    };
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "email", label: "Email", icon: <Mail className="w-3.5 h-3.5" /> },
    { id: "phone", label: "Phone", icon: <Phone className="w-3.5 h-3.5" /> },
    { id: "google", label: "Google", icon: <GoogleIcon /> },
  ];

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors";

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-md">
          <Bot className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          {mode === "login" ? "Welcome to AvenZa-AI" : "Create your account"}
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {mode === "login"
            ? "Sign in to continue chatting"
            : "Get started with your AI assistant"}
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5 text-center">
          {error}
        </div>
      )}

      <div className="flex bg-[var(--bg-secondary)] rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setError("");
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "email" && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="space-y-3">
            {mode === "register" && (
              <input
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            )}
            <input
              type="text"
              placeholder="Username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              placeholder="Password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] py-3 text-white font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? "Loading..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      )}

      {activeTab === "phone" && (
        <div className="space-y-4">
          {phoneStep === "input" ? (
            <>
              <div className="flex gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="flex items-center gap-1 h-full rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    <span className="text-xs font-medium">{selectedCountry.label}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{countryCode}</span>
                    <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" />
                  </button>
                  {showCountryPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1 min-w-[160px]">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCountryCode(c.code);
                            setShowCountryPicker(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors ${
                            countryCode === c.code ? "text-[var(--accent)] font-medium" : "text-[var(--text-primary)]"
                          }`}
                        >
                          <span className="text-xs font-medium w-6">{c.label}</span>
                          <span>{c.code}</span>
                          <span className="text-xs text-[var(--text-tertiary)]">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={handlePhoneSend}
                disabled={phoneLoading || phone.replace(/\D/g, "").length < 6}
                className="w-full rounded-xl bg-[var(--accent)] py-3 text-white font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {phoneLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {phoneLoading ? "Sending..." : "Send Code"}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--text-secondary)] text-center">
                Code sent to {countryCode} {phone}
              </p>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                required
                maxLength={6}
                value={phoneCode}
                onChange={(e) =>
                  setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className={`${inputClass} text-center tracking-[0.5em] text-lg`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep("input");
                    setPhoneCode("");
                    setError("");
                  }}
                  className="flex-1 rounded-xl border border-[var(--border)] py-3 text-[var(--text-primary)] font-medium text-sm hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handlePhoneVerify}
                  disabled={phoneLoading || phoneCode.length < 6}
                  className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-white font-medium text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {phoneLoading && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {phoneLoading ? "Verifying..." : "Verify & Sign In"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "google" && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={loading}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] py-3 text-[var(--text-primary)] font-medium text-sm hover:bg-[var(--bg-secondary)] disabled:opacity-50 transition-colors flex items-center justify-center gap-3"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>
          <p className="text-xs text-[var(--text-tertiary)] text-center">
            You&apos;ll be redirected to Google to complete sign-in
          </p>
        </div>
      )}

      <p className="text-center text-sm text-[var(--text-secondary)]">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-[var(--accent)] hover:underline font-medium"
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[var(--accent)] hover:underline font-medium"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
