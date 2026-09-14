"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { NotificationBell } from "@/components/NotificationBell";
import { SettingsMenu } from "@/components/SettingsMenu";
import { SuggestedUsers } from "@/components/SuggestedUsers";
import { api, type Post, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Tab = "following" | "overview";

export default function HomePage() {
  const { dict } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
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
  }, []);

  return (
    <AppShell user={user} onPostCreated={setInjectedPost}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex flex-wrap items-center justify-between gap-y-2 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur md:hidden">
        <span className="flex items-center gap-2">
          <span className="logo-mark h-7 w-7 text-sm">Y</span>
          <span className="text-gradient text-xl font-extrabold tracking-tight">{dict.common.appName}</span>
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Когда рядом есть кнопки входа, шестерёнка стоит левее и меню открывается вправо.
              Когда пользователь залогинен, шестерёнка одна прижата к правому краю экрана —
              там меню нужно открывать влево, иначе оно вылезает за пределы экрана. */}
          <NotificationBell user={user} />
          <SettingsMenu align={checkedAuth && !user ? "left" : "right"} />
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
        {user && (user.role !== "user" || user.university_topic_id !== null) && (
          <Link
            href="/communities"
            className="flex-1 rounded-lg py-2 text-center text-sm font-bold text-[var(--fg-muted)] transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            {dict.communities.title}
          </Link>
        )}
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
              emptyExtra={<SuggestedUsers />}
              currentUsername={user.username}
              storageKey="following"
              injectedPost={injectedPost}
            />
          )}
        </>
      )}

      {tab === "overview" && (
        <FeedList
          endpoint="/feed/overview"
          emptyMessage={dict.feed.emptyOverview}
          currentUsername={user?.username}
          storageKey="overview"
        />
      )}
    </AppShell>
  );
}
