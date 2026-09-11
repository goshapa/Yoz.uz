"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { AuthCard } from "@/components/AuthCard";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const { dict } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => router.push("/login"), 1500);
    return () => clearTimeout(timeout);
  }, [success, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError(dict.auth.verifyEmailMissing);
      return;
    }

    setSubmitting(true);
    try {
      await api.post<{ message: string }>("/auth/verify-email", { email: email.trim(), code });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email.trim() || cooldown > 0) return;
    setResendMessage(null);
    setError(null);
    try {
      const res = await api.post<{ message: string }>("/auth/resend-verification", { email: email.trim() });
      setResendMessage(res.message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    }
  }

  if (success) {
    return (
      <AuthCard title={dict.auth.verifyEmailTitle}>
        <p className="text-sm text-emerald-600">✓ {dict.auth.verifyEmailSuccess}</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={dict.auth.verifyEmailTitle}>
      <p className="mb-4 text-sm text-[var(--fg-muted)]">{dict.auth.verifyEmailHint}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="verify-email">
            {dict.auth.email}
          </label>
          <input
            id="verify-email"
            type="email"
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="verify-code">
            {dict.auth.verifyEmailCode}
          </label>
          <input
            id="verify-code"
            ref={codeInputRef}
            className="input text-center text-2xl font-semibold tracking-[0.5em]"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
          />
        </div>

        {error && <p className="field-error">{error}</p>}
        {resendMessage && !error && <p className="text-sm text-emerald-600">{resendMessage}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting || code.length !== 6}>
          {submitting ? dict.common.loading : dict.auth.verifyEmailSubmit}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || !email.trim()}
        className="mt-4 text-sm text-accent-600 disabled:opacity-50 dark:text-accent-400"
      >
        {cooldown > 0 ? `${dict.auth.verifyEmailResend} (${cooldown}с)` : dict.auth.verifyEmailResend}
      </button>

      <p className="mt-4 text-center text-sm text-[var(--fg-muted)]">
        <Link href="/login" className="text-accent-600 dark:text-accent-400">
          {dict.auth.goLogin}
        </Link>
      </p>
    </AuthCard>
  );
}
