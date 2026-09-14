"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Choice = "rock" | "paper" | "scissors";
const CHOICES: Choice[] = ["rock", "paper", "scissors"];
const EMOJI: Record<Choice, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
const BEATS: Record<Choice, Choice> = { rock: "scissors", paper: "rock", scissors: "paper" };

type Result = "win" | "lose" | "draw";

export default function RockPaperScissorsPage() {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [round, setRound] = useState<{ player: Choice; computer: Choice; result: Result } | null>(null);
  const [tally, setTally] = useState<Record<Result, number>>({ win: 0, lose: 0, draw: 0 });

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  function play(player: Choice) {
    const computer = CHOICES[Math.floor(Math.random() * CHOICES.length)];
    let result: Result;
    if (player === computer) result = "draw";
    else if (BEATS[player] === computer) result = "win";
    else result = "lose";
    setRound({ player, computer, result });
    setTally((current) => ({ ...current, [result]: current[result] + 1 }));
  }

  function resetScore() {
    setTally({ win: 0, lose: 0, draw: 0 });
    setRound(null);
  }

  const resultLabel = round
    ? round.result === "draw"
      ? dict.games.draw
      : round.result === "win"
        ? dict.games.youWin
        : dict.games.youLose
    : null;

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href="/games" className="text-sm font-bold text-[var(--fg-muted)] hover:underline">
          ← {dict.games.back}
        </Link>
        <h1 className="min-w-0 truncate font-medium">{dict.games.rps.title}</h1>
      </header>
      <div className="border-b border-[var(--border)]" />

      <div className="flex flex-col items-center gap-5 px-4 py-8">
        <div className="flex gap-3 text-center text-xs font-semibold text-[var(--fg-muted)]">
          <span>
            {dict.games.rps.wins}: <span className="text-[var(--fg)]">{tally.win}</span>
          </span>
          <span>
            {dict.games.rps.losses}: <span className="text-[var(--fg)]">{tally.lose}</span>
          </span>
          <span>
            {dict.games.rps.draws}: <span className="text-[var(--fg)]">{tally.draw}</span>
          </span>
        </div>

        {round && (
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-500/10 text-3xl">
                {EMOJI[round.player]}
              </span>
              <span className="text-xs font-semibold text-[var(--fg-muted)]">{dict.games.you}</span>
            </div>
            <span className="text-lg font-bold text-[var(--fg-muted)]">vs</span>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sun-500/10 text-3xl">
                {EMOJI[round.computer]}
              </span>
              <span className="text-xs font-semibold text-[var(--fg-muted)]">{dict.games.computer}</span>
            </div>
          </div>
        )}

        {resultLabel && <p className="text-lg font-bold">{resultLabel}</p>}

        <div className="flex gap-3">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => play(choice)}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] text-3xl transition hover:border-accent-600 hover:bg-accent-500/5"
              aria-label={dict.games.rps[choice]}
            >
              {EMOJI[choice]}
            </button>
          ))}
        </div>
        <div className="flex gap-4 text-xs font-semibold text-[var(--fg-muted)]">
          <span>{dict.games.rps.rock}</span>
          <span>{dict.games.rps.paper}</span>
          <span>{dict.games.rps.scissors}</span>
        </div>

        {(tally.win || tally.lose || tally.draw) > 0 && (
          <button type="button" onClick={resetScore} className="btn-secondary-sm">
            {dict.games.rps.resetScore}
          </button>
        )}
      </div>
    </AppShell>
  );
}
