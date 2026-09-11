"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { FeedList } from "@/components/FeedList";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function BookmarksPage() {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckedAuth(true));
  }, []);

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <h1 className="font-medium">{dict.bookmarks.title}</h1>
      </header>
      <div className="border-b border-[var(--border)]" />

      {checkedAuth && !user && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.errors.loginRequired}</div>
      )}
      {user && (
        <FeedList
          endpoint="/bookmarks"
          emptyMessage={dict.bookmarks.empty}
          currentUsername={user.username}
          storageKey="bookmarks"
        />
      )}
    </AppShell>
  );
}
