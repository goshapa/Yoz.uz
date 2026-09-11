"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/AuthCard";
import { api, ApiError, type LoginResult } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { dict } = useI18n();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<LoginResult>("/auth/login", { email, password });
      if (result.requires_2fa && result.challenge_token) {
        setChallengeToken(result.challenge_token);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      if (err instanceof ApiError && err.message === "EMAIL_NOT_VERIFIED") {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setError(
        err instanceof ApiError && err.status === 401
          ? dict.errors.invalidCredentials
          : dict.errors.generic
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/2fa/verify-login", { challenge_token: challengeToken, code });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  if (challengeToken) {
    return (
      <AuthCard title={dict.auth.twoFactorTitle}>
        <form onSubmit={handleVerify2fa} className="space-y-4">
          <div>
            <label className="label" htmlFor="code">
              {dict.auth.twoFactorCode}
            </label>
            <input
              id="code"
              className="input"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? dict.common.loading : dict.auth.submitLogin}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={dict.auth.loginTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            {dict.auth.email}
          </label>
          <input
            id="email"
            type="email"
            className="input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            {dict.auth.password}
          </label>
          <input
            id="password"
            type="password"
            className="input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="field-error">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? dict.common.loading : dict.auth.submitLogin}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-accent-600 dark:text-accent-400">
          {dict.auth.forgotLink}
        </Link>
        <span className="text-[var(--fg-muted)]">
          {dict.auth.noAccount}{" "}
          <Link href="/signup" className="text-accent-600 dark:text-accent-400">
            {dict.auth.goSignup}
          </Link>
        </span>
      </div>
    </AuthCard>
  );
}
