"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { SettingsMenu } from "@/components/SettingsMenu";
import { api, type Post, type Topic, type UserMe } from "@/lib/api";
import { topicName, useI18n } from "@/lib/i18n";

type Tab = "following" | "overview";

export default function HomePage() {
  const { dict, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicFilter, setTopicFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [injectedPost, setInjectedPost] = useState<Post | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then((u) => {
        setUser(u);
        setTab("following");
      })
      .catch(() => setUser(null))
      .finally(() => setCheckedAuth(true));

    api
      .get<Topic[]>("/topics")
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  const overviewEndpoint = (() => {
    const params = new URLSearchParams();
    if (topicFilter) params.set("topic", topicFilter);
    if (cityFilter.trim()) params.set("city", cityFilter.trim());
    const qs = params.toString();
    return `/feed/overview${qs ? `?${qs}` : ""}`;
  })();

  return (
    <AppShell user={user} onPostCreated={setInjectedPost}>
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-y-2 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur md:hidden">
        <span className="flex items-center gap-2">
          <span className="logo-mark h-7 w-7 text-sm">Y</span>
          <span className="text-gradient text-xl font-extrabold tracking-tight">{dict.common.appName}</span>
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SettingsMenu />
          {checkedAuth && !user && (
            <>
              <Link href="/login" className="btn-secondary-sm">
                {dict.auth.goLogin}
              </Link>
              <Link href="/signup" className="btn-primary-sm">
                {dict.auth.goSignup}
              </Link>
            </>
          )}
        </div>
      </header>

      <nav className="mx-3 mt-3 flex gap-1 rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("following")}
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
            tab === "following"
              ? "bg-accent-600 text-white shadow-md shadow-accent-900/30"
              : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          {dict.feed.tabFollowing}
        </button>
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
            tab === "overview"
              ? "bg-accent-600 text-white shadow-md shadow-accent-900/30"
              : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          {dict.feed.tabOverview}
        </button>
      </nav>

      {tab === "following" && (
        <>
          {checkedAuth && !user && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p className="text-[var(--fg-muted)]">{dict.feed.emptyFollowing}</p>
              <Link href="/signup" className="btn-primary">
                {dict.feed.findUsers}
              </Link>
            </div>
          )}
          {user && (
            <FeedList
              endpoint="/feed/following"
              emptyMessage={dict.feed.emptyFollowing}
              currentUsername={user.username}
              storageKey="following"
              injectedPost={injectedPost}
            />
          )}
        </>
      )}

      {tab === "overview" && (
        <>
          <div className="mx-3 mt-3 flex gap-2">
            <select
              className="input w-auto text-base sm:text-xs"
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
              className="input w-auto text-base sm:text-xs"
              placeholder={dict.feed.cityPlaceholder}
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
          </div>
          <FeedList
            key={overviewEndpoint}
            endpoint={overviewEndpoint}
            emptyMessage={dict.feed.emptyOverview}
            currentUsername={user?.username}
            storageKey="overview"
          />
        </>
      )}
    </AppShell>
  );
}
