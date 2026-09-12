"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { LoadingState } from "@/components/Spinner";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";
import { api, ApiError, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function SettingsPage() {
  const { dict } = useI18n();
  const router = useRouter();

  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [logoutAllDone, setLogoutAllDone] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const avatarPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then((u) => {
        setUser(u);
        setDisplayName(u.display_name);
        setUsername(u.username);
        setBio(u.bio ?? "");
        setCity(u.city ?? "");
        setWebsite(u.website ?? "");
      })
      .catch(() => setUser(null))
      .finally(() => setCheckedAuth(true));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.append("display_name", displayName);
    formData.append("username", username);
    formData.append("bio", bio);
    formData.append("city", city);
    formData.append("website", website);
    if (avatarFile) formData.append("avatar", avatarFile);
    if (coverFile) formData.append("cover", coverFile);

    setSaving(true);
    try {
      const updated = await api.patchForm<UserMe>("/users/me", formData);
      setUser(updated);
      setSaved(true);
      setAvatarFile(null);
      setCoverFile(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => router.push(`/u/${updated.username}`), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await api.post("/auth/logout").catch(() => undefined);
    router.push("/login");
  }

  async function handleLogoutAll() {
    await api.post("/auth/logout-all").catch(() => undefined);
    setLogoutAllDone(true);
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await api.post("/users/me/delete", { password: deletePassword });
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : dict.errors.generic);
    }
  }

  if (!checkedAuth) {
    return (
      <AppShell user={null}>
        <LoadingState label={dict.common.loading} />
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-6">
        <h1 className="text-lg font-semibold">{dict.settings.title}</h1>

        {saved && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600">
            ✓ {dict.settings.saved}
          </p>
        )}

        {user && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar src={avatarPreview ?? user.avatar_url} name={user.display_name} size={64} />
              <label className="btn-secondary-sm cursor-pointer">
                {dict.settings.avatar}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className="btn-secondary-sm cursor-pointer">
                {dict.settings.cover}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <label className="label" htmlFor="settings-display-name">
                {dict.settings.displayName}
              </label>
              <input
                id="settings-display-name"
                className="input"
                maxLength={50}
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="settings-username">
                {dict.settings.username}
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--fg-muted)]">@</span>
                <input
                  id="settings-username"
                  className="input"
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]{3,20}"
                  title={dict.settings.usernameHint}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">{dict.settings.usernameHint}</p>
            </div>

            <div>
              <label className="label" htmlFor="settings-bio">
                {dict.settings.bio}
              </label>
              <textarea
                id="settings-bio"
                className="input min-h-[80px]"
                maxLength={160}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <p className="mt-1 text-xs text-[var(--fg-muted)]">{dict.settings.bioHint}</p>
            </div>

            <div>
              <label className="label" htmlFor="settings-city">
                {dict.settings.city}
              </label>
              <input id="settings-city" className="input" maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="settings-website">
                {dict.settings.website}
              </label>
              <input
                id="settings-website"
                className="input"
                maxLength={255}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {error && <p className="field-error">{error}</p>}
            {saved && <p className="text-sm text-emerald-600">{dict.settings.saved}</p>}

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? dict.common.loading : dict.settings.save}
            </button>
          </form>
        )}

        <PushNotificationSettings />

        <div className="space-y-3 border-t border-[var(--border)] pt-6">
          <h2 className="text-sm font-semibold text-[var(--fg-muted)]">{dict.settings.account}</h2>
          <button type="button" onClick={handleLogout} className="btn-secondary w-full">
            {dict.settings.logout}
          </button>
          <button type="button" onClick={handleLogoutAll} className="btn-secondary w-full">
            {dict.settings.logoutAll}
          </button>
          {logoutAllDone && <p className="text-xs text-[var(--fg-muted)]">{dict.settings.logoutAllDone}</p>}
        </div>

        {user && user.role !== "user" && <TwoFactorSettings user={user} onChange={setUser} />}

        <div className="space-y-3 border-t border-[var(--border)] pt-6">
          <h2 className="text-sm font-semibold text-red-600">{dict.settings.deleteAccount}</h2>
          <p className="text-xs text-[var(--fg-muted)]">{dict.settings.deleteAccountWarning}</p>
          <form onSubmit={handleDeleteAccount} className="space-y-2">
            <input
              type="password"
              className="input"
              placeholder={dict.auth.password}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
            {deleteError && <p className="field-error">{deleteError}</p>}
            <button type="submit" className="btn-secondary w-full border-red-500 text-red-600">
              {confirmingDelete ? dict.settings.deleteAccountConfirm : dict.settings.deleteAccount}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
