"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { LoadingState } from "@/components/Spinner";
import { api, type Topic, type TopicMembership, type UserMe } from "@/lib/api";
import { topicName, useI18n } from "@/lib/i18n";

export default function CommunityPage() {
  const { dict, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const topicId = params.id;

  const [user, setUser] = useState<UserMe | null>(null);
  const [topic, setTopic] = useState<Topic | null | "not-found">(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    api
      .get<Topic[]>("/topics")
      .then((topics) => setTopic(topics.find((t) => t.id === topicId) ?? "not-found"))
      .catch(() => setTopic("not-found"));
  }, [topicId]);

  async function toggleMembership() {
    if (!topic || topic === "not-found" || busy) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setBusy(true);
    try {
      const result = topic.is_member
        ? await api.del<TopicMembership>(`/topics/${topic.id}/membership`)
        : await api.post<TopicMembership>(`/topics/${topic.id}/membership`);
      setTopic((current) =>
        current && current !== "not-found"
          ? { ...current, is_member: result.is_member, members_count: result.members_count }
          : current
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell user={user}>
      {topic === null && <LoadingState label={dict.common.loading} />}
      {topic === "not-found" && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.communities.notFound}</div>
      )}

      {topic && topic !== "not-found" && (
        <>
          <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center justify-between gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
            <div className="min-w-0">
              <h1 className="truncate font-semibold">{topicName(topic, locale)}</h1>
              <p className="text-xs text-[var(--fg-muted)]">
                {topic.members_count} {dict.communities.membersCount}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleMembership}
              disabled={busy}
              className={topic.is_member ? "btn-secondary-sm shrink-0" : "btn-primary-sm shrink-0"}
            >
              {topic.is_member ? dict.communities.leave : dict.communities.join}
            </button>
          </header>
          <div className="border-b border-[var(--border)]" />

          <FeedList
            key={topic.id}
            endpoint={`/feed/overview?topic=${topic.id}`}
            emptyMessage={dict.communities.emptyFeed}
            currentUsername={user?.username}
            storageKey={`community-${topic.id}`}
          />
        </>
      )}
    </AppShell>
  );
}
