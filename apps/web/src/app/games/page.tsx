"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/icons";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const GAMES = [
  { slug: "tic-tac-toe", icon: "x" as const },
  { slug: "2048", icon: "gamepad" as const },
  { slug: "quiz", icon: "check" as const },
];

export default function GamesPage() {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const gameDict = {
    "tic-tac-toe": dict.games.ticTacToe,
    "2048": dict.games.game2048,
    quiz: dict.games.quiz,
  };

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <h1 className="font-medium">{dict.games.title}</h1>
        <p className="text-xs text-[var(--fg-muted)]">{dict.games.subtitle}</p>
      </header>
      <div className="border-b border-[var(--border)]" />

      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
        {GAMES.map((game) => {
          const info = gameDict[game.slug as keyof typeof gameDict];
          return (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="card flex items-center gap-3 p-4 transition hover:border-accent-500/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 dark:text-accent-400">
                <Icon name={game.icon} size={22} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{info.title}</span>
                <span className="block truncate text-xs text-[var(--fg-muted)]">{info.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
