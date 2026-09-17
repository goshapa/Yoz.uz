"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon } from "@/components/icons";
import { LoadingState, Spinner } from "@/components/Spinner";
import { api, ApiError, type Group, type SearchUser, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function GroupSettingsPage() {
  const { dict } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [viewer, setViewer] = useState<UserMe | null>(null);
  const [group, setGroup] = useState<Group | null | "not-found">(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState<SearchUser[] | null>(null);
  const [addSearching, setAddSearching] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setViewer)
      .catch(() => setViewer(null));
  }, []);

  useEffect(() => {
    api
      .get<Group>(`/groups/${groupId}`)
      .then((g) => {
        setGroup(g);
        if (!initializedRef.current) {
          setTitle(g.title);
          setDescription(g.description ?? "");
          initializedRef.current = true;
        }
      })
      .catch(() => setGroup("not-found"));
  }, [groupId]);

  useEffect(() => {
    const trimmed = addQuery.trim();
    if (!trimmed) {
      setAddResults(null);
      return;
    }
    const existingUsernames = new Set(
      group && group !== "not-found" ? group.members.map((m) => m.username) : []
    );
    const timeout = setTimeout(() => {
      setAddSearching(true);
      api
        .get<{ users: SearchUser[] }>(`/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => setAddResults(res.users.filter((u) => !existingUsernames.has(u.username))))
        .catch(() => setAddResults([]))
        .finally(() => setAddSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [addQuery, group]);

  function handleAvatarPick(file: File | null) {
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      if (avatarFile) formData.append("avatar", avatarFile);
      const updated = await api.patchForm<Group>(`/groups/${groupId}`, formData);
      setGroup(updated);
      setAvatarFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(u: SearchUser) {
    try {
      const updated = await api.post<Group>(`/groups/${groupId}/members`, { usernames: [u.username] });
      setGroup(updated);
      setAddQuery("");
      setAddResults(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (confirmingRemove !== userId) {
      setConfirmingRemove(userId);
      return;
    }
    try {
      await api.del(`/groups/${groupId}/members/${userId}`);
      const updated = await api.get<Group>(`/groups/${groupId}`);
      setGroup(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setConfirmingRemove(null);
    }
  }

  async function handleLeave() {
    if (!viewer) return;
    if (!confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    try {
      await api.del(`/groups/${groupId}/members/${viewer.id}`);
      router.push("/messages");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
      setConfirmingLeave(false);
    }
  }

  async function handleClearChat() {
    try {
      await api.del(`/groups/${groupId}`);
      router.push("/messages");
    } catch {
      // молча игнорируем
    }
  }

  const isOwner = group !== null && group !== "not-found" && group.is_owner;

  return (
    <AppShell user={viewer}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href={`/groups/${groupId}`} className="btn-secondary-sm shrink-0" aria-label={dict.groups.back}>
          ←
        </Link>
        <h1 className="font-medium">{dict.groups.info}</h1>
      </header>

      {group === null && <LoadingState label={dict.common.loading} />}
      {group === "not-found" && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.groups.notFound}</div>
      )}

      {group && group !== "not-found" && (
        <div className="px-4 pb-8">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="relative">
              <Avatar src={avatarPreview ?? group.avatar_url} name={group.title} size={88} />
              {isOwner && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarPick(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent-600 text-white shadow-md"
                  >
                    <Icon name="pencil" size={13} />
                  </button>
                </>
              )}
            </div>

            {isOwner ? (
              <div className="w-full max-w-sm space-y-2">
                <input
                  className="input text-center"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={dict.groups.groupNamePlaceholder}
                />
                <textarea
                  className="input min-h-[70px] resize-none"
                  value={description}
                  maxLength={500}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={dict.groups.groupDescriptionPlaceholder}
                />
                {error && <p className="field-error">{error}</p>}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !title.trim()}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {saving ? <Spinner size={16} className="text-white" /> : saved ? dict.groups.saved : dict.settings.save}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-lg font-semibold">{group.title}</h2>
                {group.description && <p className="mt-1 text-sm text-[var(--fg-muted)]">{group.description}</p>}
              </div>
            )}
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-[var(--fg-muted)]">
              {dict.groups.membersTitle} · {group.member_count}
            </h3>

            <div className="mb-3">
              <input
                className="input"
                placeholder={dict.groups.addMembers}
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
              />
              {addSearching && <LoadingState label={dict.common.loading} />}
              {!addSearching &&
                addResults?.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleAddMember(u)}
                    className="card mt-2 flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <Avatar src={u.avatar_url} name={u.display_name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.display_name}</p>
                      <p className="truncate text-xs text-[var(--fg-muted)]">@{u.username}</p>
                    </div>
                    <Icon name="user-plus" size={16} className="text-accent-600" />
                  </button>
                ))}
            </div>

            {group.members.map((m) => (
              <div key={m.id} className="card mb-2 flex items-center gap-3 px-3 py-2">
                <Link href={`/u/${m.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar src={m.avatar_url} name={m.display_name} size={36} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      {m.display_name}
                      {m.is_founder && <FounderBadge size={9} />}
                    </p>
                    <p className="truncate text-xs text-[var(--fg-muted)]">
                      @{m.username} {m.role === "owner" && `· ${dict.groups.owner}`}
                    </p>
                  </div>
                </Link>
                {isOwner && m.role !== "owner" && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    onBlur={() => setConfirmingRemove(null)}
                    className={`shrink-0 rounded-full p-2 ${
                      confirmingRemove === m.id
                        ? "bg-red-500/10 text-xs font-semibold text-red-600"
                        : "text-[var(--fg-muted)] hover:bg-red-500/10 hover:text-red-600"
                    }`}
                  >
                    {confirmingRemove === m.id ? dict.groups.remove : <Icon name="x" size={14} />}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={handleClearChat} className="btn-secondary w-full text-red-600">
              {dict.messages.deleteChat}
            </button>
            {!isOwner && (
              <button
                type="button"
                onClick={handleLeave}
                onBlur={() => setConfirmingLeave(false)}
                className="btn-secondary w-full text-red-600"
              >
                {confirmingLeave ? dict.groups.leaveConfirm : dict.groups.leaveGroup}
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
