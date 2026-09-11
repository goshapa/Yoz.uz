"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { api, type PostAuthor } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function SuggestedUsers() {
  const { dict } = useI18n();
  const [users, setUsers] = useState<PostAuthor[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PostAuthor[]>("/users/suggestions/follow")
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  async function follow(u: PostAuthor) {
    if (busyId) return;
    setBusyId(u.id);
    try {
      await api.post(`/users/${u.username}/follow`);
      setUsers((current) => current?.filter((x) => x.id !== u.id) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  if (!users || users.length === 0) return null;

  return (
    <div className="mt-6 w-full text-left">
      <h2 className="mb-2 px-1 text-sm font-semibold text-[var(--fg-muted)]">{dict.feed.suggestedTitle}</h2>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card flex items-center gap-3 px-4 py-3">
            <Link href={`/u/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar src={u.avatar_url} name={u.display_name} />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">
                  {u.display_name}
                  {u.is_founder && <FounderBadge size={9} />}
                </p>
                <p className="truncate text-xs text-[var(--fg-muted)]">@{u.username}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => follow(u)}
              disabled={busyId === u.id}
              className="btn-primary-sm shrink-0"
            >
              {dict.profile.follow}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
