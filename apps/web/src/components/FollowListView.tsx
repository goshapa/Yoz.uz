"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { LoadingState } from "@/components/Spinner";
import { api, ApiError, type FollowListPage, type PostAuthor, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function FollowListView({ kind }: { kind: "followers" | "following" }) {
  const { dict } = useI18n();
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [viewer, setViewer] = useState<UserMe | null>(null);
  const [items, setItems] = useState<PostAuthor[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setViewer)
      .catch(() => setViewer(null));
  }, []);

  useEffect(() => {
    setItems(null);
    setForbidden(false);
    api
      .get<FollowListPage>(`/users/${username}/${kind}`)
      .then((page) => {
        setItems(page.items);
        setNextCursor(page.next_cursor);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        }
        setItems([]);
      });
  }, [username, kind]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.get<FollowListPage>(
        `/users/${username}/${kind}?cursor=${encodeURIComponent(nextCursor)}`
      );
      setItems((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  const title = kind === "followers" ? dict.profile.followersTitle : dict.profile.followingTitle;
  const emptyMessage = kind === "followers" ? dict.profile.emptyFollowers : dict.profile.emptyFollowing;

  return (
    <AppShell user={viewer}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href={`/u/${username}`} className="btn-secondary-sm shrink-0" aria-label={dict.postDetail.back}>
          ←
        </Link>
        <h1 className="font-medium">{title}</h1>
      </header>

      {items === null && <LoadingState label={dict.common.loading} />}

      {items && forbidden && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.profile.onlyOwnerCanView}</div>
      )}

      {items && !forbidden && items.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{emptyMessage}</div>
      )}

      {items && !forbidden && items.length > 0 && (
        <>
          {items.map((u) => (
            <Link
              key={u.id}
              href={`/u/${u.username}`}
              className="card mx-3 my-2 flex items-center gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/[0.06]"
            >
              <Avatar src={u.avatar_url} name={u.display_name} />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">
                  {u.display_name}
                  {u.is_founder && <FounderBadge size={9} />}
                </p>
                <p className="truncate text-xs text-[var(--fg-muted)]">@{u.username}</p>
              </div>
            </Link>
          ))}

          {nextCursor && (
            <div className="py-4 text-center">
              <button type="button" onClick={loadMore} className="btn-secondary-sm" disabled={loadingMore}>
                {loadingMore ? dict.feed.loadingMore : dict.messages.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
