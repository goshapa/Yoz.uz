"use client";

import { useState } from "react";

import { api, ApiError, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type TwoFactorSetup = { secret: string; provisioning_uri: string };
type SetupState = TwoFactorSetup | null;

export function TwoFactorSettings({
  user,
  onChange,
}: {
  user: UserMe;
  onChange: (user: UserMe) => void;
}) {
  const { dict } = useI18n();
  const [setup, setSetup] = useState<SetupState>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<TwoFactorSetup>("/auth/2fa/setup");
      setSetup(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/2fa/confirm", { code });
      setSetup(null);
      setCode("");
      onChange({ ...user, totp_enabled: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/auth/2fa/disable", { password });
      setPassword("");
      onChange({ ...user, totp_enabled: false });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-6">
      <h2 className="text-sm font-semibold text-[var(--fg-muted)]">{dict.settings.twoFactor}</h2>
      <p className="text-xs text-[var(--fg-muted)]">{dict.settings.twoFactorHint}</p>

      {user.totp_enabled ? (
        <form onSubmit={disable2fa} className="space-y-2">
          <p className="text-sm text-emerald-600">{dict.settings.twoFactorEnabled}</p>
          <input
            type="password"
            className="input"
            placeholder={dict.auth.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="field-error">{error}</p>}
          <button type="submit" className="btn-secondary w-full" disabled={busy}>
            {dict.settings.twoFactorDisable}
          </button>
        </form>
      ) : setup ? (
        <form onSubmit={confirmSetup} className="space-y-2">
          <p className="text-xs">{dict.settings.twoFactorScan}</p>
          <p className="break-all rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5">{setup.secret}</p>
          <input
            className="input"
            inputMode="numeric"
            placeholder={dict.auth.twoFactorCode}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          {error && <p className="field-error">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {dict.settings.twoFactorConfirm}
          </button>
        </form>
      ) : (
        <>
          {error && <p className="field-error">{error}</p>}
          <button type="button" onClick={startSetup} className="btn-secondary w-full" disabled={busy}>
            {dict.settings.twoFactorEnable}
          </button>
        </>
      )}
    </div>
  );
}
