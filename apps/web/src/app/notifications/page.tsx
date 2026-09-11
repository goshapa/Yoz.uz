"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon, type IconName } from "@/components/icons";
import { LoadingState } from "@/components/Spinner";
import { api, type NotificationItem, type NotificationPage, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/time";

const MESSAGE_KEY = {
  follow: "followed",
  like: "liked",
  repost: "reposted",
  reply: "replied",
  mention: "mentioned",
} as const;

const TYPE_STYLE: Record<NotificationItem["type"], { icon: IconName; filled: boolean; classes: string }> = {
  like: { icon: "heart", filled: true, classes: "bg-rose-500/15 text-rose-500" },
  repost: { icon: "repost", filled: false, classes: "bg-emerald-500/15 text-emerald-500" },
  reply: { icon: "reply", filled: false, classes: "bg-accent-500/15 text-accent-500" },
  mention: { icon: "at", filled: false, classes: "bg-sun-500/15 text-sun-500" },
  follow: { icon: "user-plus", filled: false, classes: "bg-violet-500/15 text-violet-500" },
};

export default function NotificationsPage() {
  const { dict, locale } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
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
      .get<NotificationPage>("/notifications")
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
      const page = await api.get<NotificationPage>(`/notifications?cursor=${encodeURIComponent(nextCursor)}`);
      setItems((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAllRead() {
    await api.post("/notifications/read-all").catch(() => undefined);
    const now = new Date().toISOString();
    setItems((current) => current?.map((n) => ({ ...n, read_at: n.read_at ?? now })) ?? null);
  }

  async function handleClick(notification: NotificationItem) {
    if (notification.read_at) return;
    await api.post(`/notifications/${notification.id}/read`).catch(() => undefined);
    const now = new Date().toISOString();
    setItems((current) => current?.map((n) => (n.id === notification.id ? { ...n, read_at: now } : n)) ?? null);
  }

  function hrefFor(notification: NotificationItem): string {
    if (notification.type === "follow" || !notification.post_id) {
      return `/u/${notification.actor.username}`;
    }
    return `/post/${notification.post_id}`;
  }

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center justify-between bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <h1 className="font-medium">{dict.notifications.title}</h1>
        {items && items.length > 0 && (
          <button type="button" onClick={markAllRead} className="btn-secondary-sm">
            {dict.notifications.markAllRead}
          </button>
        )}
      </header>

      {checkedAuth && !user && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.errors.loginRequired}</div>
      )}
      {user && items === null && (
        <LoadingState label={dict.common.loading} />
      )}
      {user && items && items.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.notifications.empty}</div>
      )}

      {user && items && items.length > 0 && (
        <>
          {items.map((n) => {
            const style = TYPE_STYLE[n.type];
            return (
              <Link
                key={n.id}
                href={hrefFor(n)}
                onClick={() => handleClick(n)}
                className={`card mx-3 my-2 flex items-start gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/[0.06] ${
                  n.read_at ? "" : "ring-1 ring-accent-500/30"
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar src={n.actor.avatar_url} name={n.actor.display_name} size={40} />
                  <span
                    className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-[var(--bg-elevated)] ${style.classes}`}
                  >
                    <Icon name={style.icon} filled={style.filled} size={12} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {n.actor.display_name}
                      {n.actor.is_founder && <FounderBadge size={9} />}
                    </span>{" "}
                    {n.actor_count > 1 && (
                      <span className="text-[var(--fg-muted)]">
                        {dict.notifications.andOthers} {n.actor_count - 1}{" "}
                      </span>
                    )}
                    <span className="text-[var(--fg-muted)]">{dict.notifications[MESSAGE_KEY[n.type]]}</span>
                  </p>
                  {n.post_preview && (
                    <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{n.post_preview}</p>
                  )}
                  <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{formatRelativeTime(n.created_at, locale)}</p>
                </div>
                {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sun-500" />}
              </Link>
            );
          })}

          {nextCursor && (
            <div className="py-4 text-center">
              <button type="button" onClick={loadMore} className="btn-secondary-sm" disabled={loadingMore}>
                {loadingMore ? dict.feed.loadingMore : dict.feed.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
