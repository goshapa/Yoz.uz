"use client";

import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon } from "@/components/icons";
import { LoadingState, Spinner } from "@/components/Spinner";
import { api, type GroupListPage, type GroupSummary, type SearchUser } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export type ForwardableMessage = {
  text: string | null;
  attachment_url: string | null;
  attachment_type: "image" | "video" | null;
  // sender_id пересылаемого сообщения, либо исходный forwarded_from.id, если уже
  // пересланное — так цепочка пересылок всегда указывает на самого первого автора.
  forwardOriginId: string;
};

export function ForwardModal({ message, onClose }: { message: ForwardableMessage; onClose: () => void }) {
  const { dict } = useI18n();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [userResults, setUserResults] = useState<SearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<GroupListPage>("/groups")
      .then((page) => setGroups(page.items))
      .catch(() => setGroups([]));
  }, []);

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
        .then((res) => setUserResults(res.users))
        .catch(() => setUserResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const filteredGroups = (groups ?? []).filter((g) => g.title.toLowerCase().includes(query.trim().toLowerCase()));

  async function sendTo(kind: "dm" | "group", id: string, label: string) {
    if (sendingKey) return;
    const key = `${kind}-${id}`;
    setSendingKey(key);
    try {
      const formData = new FormData();
      if (message.text) formData.append("text", message.text);
      formData.append("forwarded_from_id", message.forwardOriginId);
      if (message.attachment_url) {
        const blob = await fetch(message.attachment_url).then((r) => r.blob());
        const ext = message.attachment_type === "video" ? "mp4" : "jpg";
        formData.append("attachment", new File([blob], `forwarded.${ext}`, { type: blob.type }));
      }
      if (kind === "dm") {
        await api.postForm(`/messages/${id}`, formData);
      } else {
        await api.postForm(`/groups/${id}/messages`, formData);
      }
      setStatus(`${dict.messages.forwardSent} · ${label}`);
      setTimeout(onClose, 900);
    } catch {
      setSendingKey(null);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-t-2xl bg-[var(--bg)] p-4 shadow-xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{dict.messages.forwardTitle}</h2>
          <button type="button" onClick={onClose} aria-label={dict.messages.editCancel}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <input
          className="input mb-3"
          placeholder={dict.messages.forwardPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {status ? (
          <p className="px-2 py-8 text-center text-sm text-[var(--fg-muted)]">{status}</p>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filteredGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => sendTo("group", g.id, g.title)}
                disabled={sendingKey !== null}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
              >
                <Avatar src={g.avatar_url} name={g.title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.title}</p>
                  <p className="truncate text-xs text-[var(--fg-muted)]">
                    {g.member_count} {dict.groups.membersCount}
                  </p>
                </div>
                {sendingKey === `group-${g.id}` && <Spinner size={16} />}
              </button>
            ))}

            {searching && <LoadingState label={dict.common.loading} />}
            {!searching && query.trim() && userResults && userResults.length === 0 && filteredGroups.length === 0 && (
              <p className="px-2 py-8 text-center text-sm text-[var(--fg-muted)]">{dict.messages.searchNoResults}</p>
            )}
            {!searching &&
              userResults?.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => sendTo("dm", u.username, u.display_name)}
                  disabled={sendingKey !== null}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                >
                  <Avatar src={u.avatar_url} name={u.display_name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-semibold">
                      {u.display_name}
                      {u.is_founder && <FounderBadge size={9} />}
                    </p>
                    <p className="truncate text-xs text-[var(--fg-muted)]">@{u.username}</p>
                  </div>
                  {sendingKey === `dm-${u.username}` && <Spinner size={16} />}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
