"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import {
  addRandomTile,
  emptyBoard,
  hasWon,
  isGameOver,
  moveBoard,
  type Board2048,
  type Direction,
} from "@/lib/game2048";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const BEST_STORAGE_KEY = "yoz-2048-best";

const TILE_STYLES: Record<number, string> = {
  2: "bg-[var(--bg-elevated)] text-[var(--fg)]",
  4: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  8: "bg-orange-200 text-orange-900 dark:bg-orange-800/50 dark:text-orange-100",
  16: "bg-orange-300 text-orange-950 dark:bg-orange-700/60 dark:text-orange-50",
  32: "bg-orange-400 text-white dark:bg-orange-600/70",
  64: "bg-orange-500 text-white dark:bg-orange-500/80",
  128: "bg-yellow-400 text-white dark:bg-yellow-500/80",
  256: "bg-yellow-500 text-white dark:bg-yellow-400/90",
  512: "bg-yellow-600 text-white",
  1024: "bg-accent-500 text-white",
  2048: "bg-accent-600 text-white",
};

function startingBoard(): Board2048 {
  return addRandomTile(addRandomTile(emptyBoard()));
}

export default function Game2048Page() {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [board, setBoard] = useState<Board2048>(() => emptyBoard());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setBoard(startingBoard());
    try {
      const stored = window.localStorage.getItem(BEST_STORAGE_KEY);
      if (stored) setBest(Number(stored) || 0);
    } catch {
      // localStorage может быть недоступен (приватный режим) — не критично.
    }
  }, []);

  const over = isGameOver(board);

  const applyMove = useCallback(
    (direction: Direction) => {
      if (over || (won && !keepPlaying)) return;
      setBoard((current) => {
        const { board: moved, moved: didMove, gained } = moveBoard(current, direction);
        if (!didMove) return current;
        if (gained) {
          setScore((s) => {
            const next = s + gained;
            setBest((b) => {
              const nextBest = Math.max(b, next);
              try {
                window.localStorage.setItem(BEST_STORAGE_KEY, String(nextBest));
              } catch {
                // ignore
              }
              return nextBest;
            });
            return next;
          });
        }
        const withNewTile = addRandomTile(moved);
        if (hasWon(withNewTile)) setWon(true);
        return withNewTile;
      });
    },
    [over, won, keepPlaying]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const map: Record<string, Direction> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const direction = map[e.key];
      if (!direction) return;
      e.preventDefault();
      applyMove(direction);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyMove]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      applyMove(dx > 0 ? "right" : "left");
    } else {
      applyMove(dy > 0 ? "down" : "up");
    }
  }

  function newGame() {
    setBoard(startingBoard());
    setScore(0);
    setWon(false);
    setKeepPlaying(false);
  }

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href="/games" className="text-sm font-bold text-[var(--fg-muted)] hover:underline">
          ← {dict.games.back}
        </Link>
        <h1 className="min-w-0 truncate font-medium">{dict.games.game2048.title}</h1>
      </header>
      <div className="border-b border-[var(--border)]" />

      <div className="flex flex-col items-center gap-4 px-4 py-6">
        <div className="flex w-full max-w-sm items-center justify-between gap-3">
          <div className="flex gap-2">
            <div className="rounded-lg bg-[var(--bg-elevated)] px-3 py-1.5 text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">{dict.games.score}</p>
              <p className="font-extrabold">{score}</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-elevated)] px-3 py-1.5 text-center">
              <p className="text-[10px] font-bold uppercase text-[var(--fg-muted)]">{dict.games.best}</p>
              <p className="font-extrabold">{best}</p>
            </div>
          </div>
          <button type="button" onClick={newGame} className="btn-secondary-sm">
            {dict.games.newGame}
          </button>
        </div>

        <p className="text-xs text-[var(--fg-muted)]">{dict.games.game2048.hint}</p>

        <div
          className="relative grid w-full max-w-sm grid-cols-4 gap-2 rounded-2xl bg-[var(--border)]/40 p-2"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {board.map((row, r) =>
            row.map((value, c) => (
              <div
                key={`${r}-${c}`}
                className={`flex aspect-square items-center justify-center rounded-lg text-xl font-extrabold shadow-sm transition-colors sm:text-2xl ${
                  value === 0 ? "bg-[var(--bg)]/60" : TILE_STYLES[value] ?? "bg-accent-700 text-white"
                }`}
              >
                {value !== 0 && value}
              </div>
            ))
          )}

          {(over || (won && !keepPlaying)) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--bg)]/85 backdrop-blur-sm">
              <p className="text-lg font-bold">{won ? dict.games.game2048.youWin : dict.games.game2048.gameOver}</p>
              <div className="flex gap-2">
                {won && !over && (
                  <button type="button" onClick={() => setKeepPlaying(true)} className="btn-secondary">
                    {dict.games.game2048.keepGoing}
                  </button>
                )}
                <button type="button" onClick={newGame} className="btn-primary">
                  {dict.games.playAgain}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
