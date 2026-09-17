"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon } from "@/components/icons";
import { LoadingState, Spinner } from "@/components/Spinner";
import { api, ApiError, type Group, type SearchUser, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Step = "members" | "details";

export default function NewGroupPage() {
  const { dict } = useI18n();
  const router = useRouter();

  const [viewer, setViewer] = useState<UserMe | null>(null);
  const [step, setStep] = useState<Step>("members");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchUser[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setViewer)
      .catch(() => setViewer(null));
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    const timeout = setTimeout(() => {
      setSearching(true);
      api
        .get<{ users: SearchUser[] }>(`/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => setResults(res.users.filter((u) => u.username !== viewer?.username)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, viewer?.username]);

  function toggleSelect(u: SearchUser) {
    setSelected((current) =>
      current.some((x) => x.id === u.id) ? current.filter((x) => x.id !== u.id) : [...current, u]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || selected.length === 0 || creating) return;
    setCreating(true);
    setError(null);
    try {
      const group = await api.post<Group>("/groups", {
        title: title.trim(),
        description: description.trim() || null,
        member_usernames: selected.map((u) => u.username),
      });
      router.push(`/groups/${group.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
      setCreating(false);
    }
  }

  return (
    <AppShell user={viewer}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => (step === "details" ? setStep("members") : router.back())}
          className="btn-secondary-sm shrink-0"
        >
          ←
        </button>
        <h1 className="font-medium">{dict.groups.newGroup}</h1>
      </header>

      {step === "members" && (
        <>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {selected.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleSelect(u)}
                  className="flex items-center gap-1.5 rounded-full bg-accent-600/10 py-1 pl-1 pr-2.5 text-xs font-medium text-accent-600 dark:text-accent-400"
                >
                  <Avatar src={u.avatar_url} name={u.display_name} size={20} />
                  {u.display_name}
                  <Icon name="x" size={12} />
                </button>
              ))}
            </div>
          )}

          <div className="px-4 pb-3">
            <input
              className="input"
              placeholder={dict.groups.selectMembersPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {searching && <LoadingState label={dict.common.loading} />}
          {!searching && query.trim() && results && results.length === 0 && (
            <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.messages.searchNoResults}</div>
          )}
          {!searching &&
            results?.map((u) => {
              const isSelected = selected.some((x) => x.id === u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleSelect(u)}
                  className="card mx-3 my-2 flex w-[calc(100%-1.5rem)] items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
                  <Avatar src={u.avatar_url} name={u.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      {u.display_name}
                      {u.is_founder && <FounderBadge size={9} />}
                    </p>
                    <p className="truncate text-xs text-[var(--fg-muted)]">@{u.username}</p>
                  </div>
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      isSelected ? "border-accent-600 bg-accent-600 text-white" : "border-[var(--border)]"
                    }`}
                  >
                    {isSelected && <Icon name="check" size={12} />}
                  </div>
                </button>
              );
            })}

          <div className="sticky bottom-0 border-t border-[var(--border)] bg-[var(--bg)]/95 p-3 backdrop-blur">
            <button
              type="button"
              onClick={() => setStep("details")}
              disabled={selected.length === 0}
              className="btn-primary w-full disabled:opacity-50"
            >
              {dict.groups.next} {selected.length > 0 && `(${selected.length})`}
            </button>
          </div>
        </>
      )}

      {step === "details" && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 px-4 py-3">
          <input
            className="input"
            placeholder={dict.groups.groupNamePlaceholder}
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder={dict.groups.groupDescriptionPlaceholder}
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="field-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={!title.trim() || creating}>
            {creating ? <Spinner size={18} className="text-white" /> : dict.groups.create}
          </button>
        </form>
      )}
    </AppShell>
  );
}
