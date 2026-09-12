"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/Spinner";
import { api, type Topic, type TopicMembership, type UserMe } from "@/lib/api";
import { formatMembersCount, topicName, useI18n } from "@/lib/i18n";

export default function CommunitiesPage() {
  const { dict, locale } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
    api
      .get<Topic[]>("/topics")
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  async function toggleMembership(topic: Topic) {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (busyId) return;
    setBusyId(topic.id);
    try {
      const result = topic.is_member
        ? await api.del<TopicMembership>(`/topics/${topic.id}/membership`)
        : await api.post<TopicMembership>(`/topics/${topic.id}/membership`);
      setTopics(
        (current) =>
          current?.map((t) =>
            t.id === topic.id ? { ...t, is_member: result.is_member, members_count: result.members_count } : t
          ) ?? null
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <h1 className="font-medium">{dict.communities.title}</h1>
        <p className="text-xs text-[var(--fg-muted)]">{dict.communities.subtitle}</p>
      </header>
      <div className="border-b border-[var(--border)]" />

      {topics === null && <LoadingState label={dict.common.loading} />}
      {topics && topics.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.communities.empty}</div>
      )}

      {topics?.map((topic) => (
        <div key={topic.id} className="card mx-3 my-2 flex items-center justify-between gap-3 px-4 py-3">
          <Link href={`/communities/${topic.id}`} className="min-w-0 flex-1">
            <p className="truncate font-semibold hover:underline">{topicName(topic, locale)}</p>
            <p className="text-xs text-[var(--fg-muted)]">
              {formatMembersCount(topic.members_count, locale)}
            </p>
          </Link>
          <button
            type="button"
            onClick={() => toggleMembership(topic)}
            disabled={busyId === topic.id}
            className={topic.is_member ? "btn-secondary-sm shrink-0" : "btn-primary-sm shrink-0"}
          >
            {topic.is_member ? dict.communities.leave : dict.communities.join}
          </button>
        </div>
      ))}
    </AppShell>
  );
}
