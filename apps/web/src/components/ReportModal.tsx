"use client";

import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const REASONS = ["spam", "abuse", "threats", "prohibited_content", "impersonation", "other"] as const;
type Reason = (typeof REASONS)[number];

export function ReportModal({
  targetType,
  targetId,
  onClose,
}: {
  targetType: "post" | "profile";
  targetId: string;
  onClose: () => void;
}) {
  const { dict } = useI18n();
  const [reason, setReason] = useState<Reason>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/reports", {
        target_type: targetType,
        target_post_id: targetType === "post" ? targetId : undefined,
        target_user_id: targetType === "profile" ? targetId : undefined,
        reason,
        details: details.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-sm font-semibold">{dict.report.title}</h2>
        {done ? (
          <>
            <p className="text-sm">{dict.report.sent}</p>
            <button type="button" onClick={onClose} className="btn-primary mt-3 w-full">
              {dict.report.close}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    reason === r
                      ? "border-accent-500 bg-accent-500/10 text-accent-700 dark:text-accent-300"
                      : "border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    className="accent-accent-500"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {dict.report.reasons[r]}
                </label>
              ))}
            </div>

            {reason === "other" && (
              <textarea
                className="input min-h-[60px]"
                placeholder={dict.report.detailsPlaceholder}
                value={details}
                maxLength={500}
                onChange={(e) => setDetails(e.target.value)}
              />
            )}

            {error && <p className="field-error">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                {dict.report.cancel}
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                {submitting ? dict.common.loading : dict.report.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
