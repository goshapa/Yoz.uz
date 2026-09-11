"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon } from "@/components/icons";
import { LoadingState } from "@/components/Spinner";
import {
  api,
  type Conversation,
  type ConversationPage,
  type GroupListPage,
  type GroupSummary,
  type SearchUser,
  type UserMe,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/time";

type ChatItem =
  | { kind: "dm"; key: string; at: string; data: Conversation }
  | { kind: "group"; key: string; at: string; data: GroupSummary };

export default function MessagesPage() {
  const { dict, locale } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const [dmItems, setDmItems] = useState<Conversation[] | null>(null);
  const [dmCursor, setDmCursor] = useState<string | null>(null);
  const [groupItems, setGroupItems] = useState<GroupSummary[] | null>(null);
  const [groupCursor, setGroupCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<SearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);

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
        setDmItems(page.items);
        setDmCursor(page.next_cursor);
      })
      .catch(() => setDmItems([]));
    api
      .get<GroupListPage>("/groups")
      .then((page) => {
        setGroupItems(page.items);
        setGroupCursor(page.next_cursor);
      })
      .catch(() => setGroupItems([]));
  }, [user]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUserResults(null);
      return;
    }

    const timeout = setTimeout(() => {
      setSearching(true);
      api
        .get<{ users: SearchUser[] }>(`/search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => setUserResults(res.users.filter((u) => u.username !== user?.username)))
        .catch(() => setUserResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, user?.username]);

  async function loadMore() {
    if (loadingMore || (!dmCursor && !groupCursor)) return;
    setLoadingMore(true);
    try {
      const [dmPage, groupPage] = await Promise.all([
        dmCursor ? api.get<ConversationPage>(`/messages?cursor=${encodeURIComponent(dmCursor)}`) : null,
        groupCursor ? api.get<GroupListPage>(`/groups?cursor=${encodeURIComponent(groupCursor)}`) : null,
      ]);
      if (dmPage) {
        setDmItems((current) => [...(current ?? []), ...dmPage.items]);
        setDmCursor(dmPage.next_cursor);
      }
      if (groupPage) {
        setGroupItems((current) => [...(current ?? []), ...groupPage.items]);
        setGroupCursor(groupPage.next_cursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const merged: ChatItem[] | null =
    dmItems === null || groupItems === null
      ? null
      : [
          ...dmItems.map((c) => ({ kind: "dm" as const, key: `dm-${c.peer.username}`, at: c.last_message_at, data: c })),
          ...groupItems.map((g) => ({ kind: "group" as const, key: `group-${g.id}`, at: g.last_message_at, data: g })),
        ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 space-y-2 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="font-medium">{dict.messages.title}</h1>
          {user && (
            <Link
              href="/messages/new-group"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/10"
              title={dict.groups.newGroup}
            >
              <Icon name="user-plus" size={18} />
            </Link>
          )}
        </div>
        {user && (
          <input
            className="input"
            placeholder={dict.messages.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </header>

      {checkedAuth && !user && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.errors.loginRequired}</div>
      )}

      {user && query.trim() && (
        <>
          {searching && <LoadingState label={dict.common.loading} />}
          {!searching && userResults && userResults.length === 0 && (
            <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.messages.searchNoResults}</div>
          )}
          {!searching &&
            userResults &&
            userResults.map((u) => (
              <Link
                key={u.id}
                href={`/messages/${u.username}`}
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
        </>
      )}

      {user && !query.trim() && merged === null && <LoadingState label={dict.common.loading} />}
      {user && !query.trim() && merged && merged.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.messages.empty}</div>
      )}

      {user && !query.trim() && merged && merged.length > 0 && (
        <>
          {merged.map((item) =>
            item.kind === "dm" ? (
              <Link
                key={item.key}
                href={`/messages/${item.data.peer.username}`}
                className="card mx-3 my-2 flex items-start gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/[0.06]"
              >
                <Avatar src={item.data.peer.avatar_url} name={item.data.peer.display_name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1 truncate font-semibold">
                      {item.data.peer.display_name}
                      {item.data.peer.is_founder && <FounderBadge size={9} />}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                      {formatRelativeTime(item.data.last_message_at, locale)}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 truncate text-sm ${
                      item.data.unread_count > 0 ? "font-semibold" : "text-[var(--fg-muted)]"
                    }`}
                  >
                    {item.data.last_message_is_mine && dict.messages.you}
                    {item.data.last_message_text ??
                      (item.data.last_message_attachment_type === "video"
                        ? `🎬 ${dict.messages.video}`
                        : `📷 ${dict.messages.photo}`)}
                  </p>
                </div>
                {item.data.unread_count > 0 && (
                  <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sun-500 px-1 text-[10px] font-semibold text-white">
                    {item.data.unread_count > 99 ? "99+" : item.data.unread_count}
                  </span>
                )}
              </Link>
            ) : (
              <Link
                key={item.key}
                href={`/groups/${item.data.id}`}
                className="card mx-3 my-2 flex items-start gap-3 px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/[0.06]"
              >
                <Avatar src={item.data.avatar_url} name={item.data.title} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1 truncate font-semibold">
                      {item.data.title}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                      {formatRelativeTime(item.data.last_message_at, locale)}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 truncate text-sm ${
                      item.data.unread_count > 0 ? "font-semibold" : "text-[var(--fg-muted)]"
                    }`}
                  >
                    {item.data.last_message_sender_name && `${item.data.last_message_sender_name}: `}
                    {item.data.last_message_text ??
                      (item.data.last_message_attachment_type === "video"
                        ? `🎬 ${dict.messages.video}`
                        : `📷 ${dict.messages.photo}`)}
                  </p>
                </div>
                {item.data.unread_count > 0 && (
                  <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sun-500 px-1 text-[10px] font-semibold text-white">
                    {item.data.unread_count > 99 ? "99+" : item.data.unread_count}
                  </span>
                )}
              </Link>
            )
          )}

          {(dmCursor || groupCursor) && (
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
