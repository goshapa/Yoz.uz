"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { LoadingState } from "@/components/Spinner";
import { api, type Conversation, type ConversationPage, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/time";

export default function MessagesPage() {
  const { dict, locale } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckedAuth(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    api
      .get<ConversationPage>("/messages")
      .then((page) => {
        setItems(page.items);
        setNextCursor(page.next_cursor);
      })
      .catch(() => setItems([]));
  }, [user]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.get<ConversationPage>(`/messages?cursor=${encodeURIComponent(nextCursor)}`);
      setItems((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AppShell user={user}>
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <h1 className="font-medium">{dict.messages.title}</h1>
      </header>

      {checkedAuth && !user && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.errors.loginRequired}</div>
      )}
      {user && items === null && <LoadingState label={dict.common.loading} />}
      {user && items && items.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.messages.empty}</div>
      )}

      {user && items && items.length > 0 && (
        <>
          {items.map((c) => (
            <Link
              key={c.peer.username}
              href={`/messages/${c.peer.username}`}
              className="card mx-3 my-2 flex items-start gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/[0.06]"
            >
              <Avatar src={c.peer.avatar_url} name={c.peer.display_name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1 truncate font-semibold">
                    {c.peer.display_name}
                    {c.peer.is_founder && <FounderBadge size={9} />}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                    {formatRelativeTime(c.last_message_at, locale)}
                  </span>
                </div>
                <p
                  className={`mt-0.5 truncate text-sm ${
                    c.unread_count > 0 ? "font-semibold" : "text-[var(--fg-muted)]"
                  }`}
                >
                  {c.last_message_is_mine && dict.messages.you}
                  {c.last_message_text ??
                    (c.last_message_attachment_type === "video" ? `🎬 ${dict.messages.video}` : `📷 ${dict.messages.photo}`)}
                </p>
              </div>
              {c.unread_count > 0 && (
                <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sun-500 px-1 text-[10px] font-semibold text-white">
                  {c.unread_count > 99 ? "99+" : c.unread_count}
                </span>
              )}
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
