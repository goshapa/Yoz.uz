"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { PostCard } from "@/components/PostCard";
import { LoadingState } from "@/components/Spinner";
import { api, type SearchResponse, type Topic, type UserMe } from "@/lib/api";
import { topicName, useI18n } from "@/lib/i18n";

type Tab = "posts" | "users";

const EMPTY_RESULT: SearchResponse = { users: [], posts: [], posts_next_cursor: null };

export default function SearchPage() {
  const { dict, locale } = useI18n();
  const [viewer, setViewer] = useState<UserMe | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("posts");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicFilter, setTopicFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setViewer)
      .catch(() => setViewer(null));
    api
      .get<Topic[]>("/topics")
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResult(null);
      return;
    }

    const timeout = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: trimmed });
      if (topicFilter) params.set("topic", topicFilter);
      if (cityFilter.trim()) params.set("city", cityFilter.trim());

      api
        .get<SearchResponse>(`/search?${params.toString()}`)
        .then(setResult)
        .catch(() => setResult(EMPTY_RESULT))
        .finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(timeout);
  }, [query, topicFilter, cityFilter]);

  return (
    <AppShell user={viewer}>
      <div className="sticky top-0 z-10 space-y-2 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <input
          className="input"
          placeholder={dict.search.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <select
            className="input min-w-0 flex-1 text-base sm:text-xs"
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
          >
            <option value="">{dict.feed.allTopics}</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topicName(topic, locale)}
              </option>
            ))}
          </select>
          <input
            className="input min-w-0 flex-1 text-base sm:text-xs"
            placeholder={dict.feed.cityPlaceholder}
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          />
        </div>
      </div>

      <nav className="mx-3 mt-3 flex gap-1 rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
            tab === "posts"
              ? "bg-accent-600 text-white shadow-md shadow-accent-900/30"
              : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          {dict.search.tabPosts}
        </button>
        <button
          type="button"
          onClick={() => setTab("users")}
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
            tab === "users"
              ? "bg-accent-600 text-white shadow-md shadow-accent-900/30"
              : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          {dict.search.tabUsers}
        </button>
      </nav>

      {!query.trim() && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.search.prompt}</div>
      )}
      {query.trim() && loading && (
        <LoadingState label={dict.common.loading} />
      )}

      {query.trim() && !loading && result && (
        <>
          {tab === "users" &&
            (result.users.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.search.noResults}</div>
            ) : (
              result.users.map((u) => (
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
              ))
            ))}

          {tab === "posts" &&
            (result.posts.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.search.noResults}</div>
            ) : (
              result.posts.map((post) => (
                <PostCard key={post.id} post={post} currentUsername={viewer?.username} />
              ))
            ))}
        </>
      )}
    </AppShell>
  );
}
