"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthCard } from "@/components/AuthCard";
import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const { dict } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError(dict.auth.passwordsMismatch);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: newPassword });
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthCard title={dict.auth.forgotTitle}>
        <p className="text-sm">{dict.auth.submitReset} ✓</p>
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
          <label className="label" htmlFor="newPassword">
            {dict.auth.newPassword}
          </label>
          <input
            id="newPassword"
            type="password"
            className="input"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
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

        {error && <p className="field-error">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? dict.common.loading : dict.auth.submitReset}
        </button>
      </form>
    </AuthCard>
  );
}
