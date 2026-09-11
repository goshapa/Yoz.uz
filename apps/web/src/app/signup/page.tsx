"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthCard } from "@/components/AuthCard";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function SignupPage() {
  const { dict } = useI18n();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(dict.auth.passwordsMismatch);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/signup", {
        display_name: displayName,
        username,
        email,
        password,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={dict.auth.signupTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="displayName">
            {dict.auth.displayName}
          </label>
          <input
            id="displayName"
            className="input"
            required
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="username">
            {dict.auth.username}
          </label>
          <input
            id="username"
            className="input"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{dict.auth.usernameHint}</p>
        </div>

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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{dict.auth.passwordHint}</p>
        </div>

        <div>
          <label className="label" htmlFor="confirmPassword">
            {dict.auth.confirmPassword}
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="input"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-[var(--fg-muted)]">
          <input
            type="checkbox"
            required
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            {dict.auth.agreeTerms} (
            <Link href="/terms" className="underline">
              {dict.legal.terms.title}
            </Link>
            ,{" "}
            <Link href="/privacy" className="underline">
              {dict.legal.privacy.title}
            </Link>
            )
          </span>
        </label>

        {error && <p className="field-error">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? dict.common.loading : dict.auth.submitSignup}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-[var(--fg-muted)]">
        {dict.auth.haveAccount}{" "}
        <Link href="/login" className="text-accent-600 dark:text-accent-400">
          {dict.auth.goLogin}
        </Link>
      </p>
    </AuthCard>
  );
}
