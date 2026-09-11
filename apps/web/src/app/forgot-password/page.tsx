"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthCard } from "@/components/AuthCard";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { dict } = useI18n();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthCard title={dict.auth.forgotTitle}>
        <p className="text-sm">{dict.auth.forgotSent}</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-accent-600 dark:text-accent-400">
          {dict.auth.goLogin}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={dict.auth.forgotTitle}>
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

        {error && <p className="field-error">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? dict.common.loading : dict.auth.submitForgot}
        </button>
      </form>

      <Link href="/login" className="mt-4 inline-block text-sm text-accent-600 dark:text-accent-400">
        {dict.auth.goLogin}
      </Link>
    </AuthCard>
  );
}
