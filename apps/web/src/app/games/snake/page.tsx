"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const GRID = 16;
const TICK_MS = 150;
const BEST_STORAGE_KEY = "yoz-snake-best";

type Point = { x: number; y: number };

function randomEmptyCell(occupied: Point[]): Point {
  while (true) {
    const cell = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    if (!occupied.some((p) => p.x === cell.x && p.y === cell.y)) return cell;
  }
}

const START_SNAKE: Point[] = [
  { x: 8, y: 8 },
  { x: 7, y: 8 },
  { x: 6, y: 8 },
];

export default function SnakePage() {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  // Детерминированный старт для совпадения с серверным рендером — реальная
  // случайная еда расставляется в эффекте после монтирования (см. resetGame).
  const [snake, setSnake] = useState<Point[]>(START_SNAKE);
  const [food, setFood] = useState<Point>({ x: 2, y: 2 });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<"playing" | "over">("playing");

  const directionRef = useRef<Point>({ x: 1, y: 0 });
  const nextDirectionRef = useRef<Point>({ x: 1, y: 0 });
  const foodRef = useRef<Point>(food);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  function resetGame() {
    directionRef.current = { x: 1, y: 0 };
    nextDirectionRef.current = { x: 1, y: 0 };
    setSnake(START_SNAKE);
    const nextFood = randomEmptyCell(START_SNAKE);
    foodRef.current = nextFood;
    setFood(nextFood);
    setScore(0);
    setStatus("playing");
  }

  useEffect(() => {
    resetGame();
    try {
      const stored = window.localStorage.getItem(BEST_STORAGE_KEY);
      if (stored) setBest(Number(stored) || 0);
    } catch {
      // localStorage может быть недоступен — не критично.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trySetDirection(dx: number, dy: number) {
    const current = directionRef.current;
    if (current.x === -dx && current.y === -dy) return;
    nextDirectionRef.current = { x: dx, y: dy };
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const map: Record<string, Point> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      trySetDirection(dir.x, dir.y);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const timeout = setTimeout(() => {
      setSnake((current) => {
        const dir = nextDirectionRef.current;
        directionRef.current = dir;
        const head = current[0];
        const newHead = { x: head.x + dir.x, y: head.y + dir.y };

        if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
          setStatus("over");
          return current;
        }

        const ateFood = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
        const body = ateFood ? current : current.slice(0, -1);
        if (body.some((p) => p.x === newHead.x && p.y === newHead.y)) {
          setStatus("over");
          return current;
        }

        const newSnake = [newHead, ...body];
        if (ateFood) {
          const next = randomEmptyCell(newSnake);
          foodRef.current = next;
          setFood(next);
          setScore((s) => {
            const nextScore = s + 1;
            setBest((b) => {
              const nextBest = Math.max(b, nextScore);
              try {
                window.localStorage.setItem(BEST_STORAGE_KEY, String(nextBest));
              } catch {
                // ignore
              }
              return nextBest;
            });
            return nextScore;
          });
        }
        return newSnake;
      });
    }, TICK_MS);
    return () => clearTimeout(timeout);
  }, [snake, status]);

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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      trySetDirection(dx > 0 ? 1 : -1, 0);
    } else {
      trySetDirection(0, dy > 0 ? 1 : -1);
    }
  }

  const snakeCells = new Map<string, "head" | "body">();
  snake.forEach((p, i) => snakeCells.set(`${p.x},${p.y}`, i === 0 ? "head" : "body"));

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href="/games" className="text-sm font-bold text-[var(--fg-muted)] hover:underline">
          ← {dict.games.back}
        </Link>
        <h1 className="min-w-0 truncate font-medium">{dict.games.snake.title}</h1>
      </header>
      <div className="border-b border-[var(--border)]" />

      <div className="flex flex-col items-center gap-3 px-4 py-6">
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
          <button type="button" onClick={resetGame} className="btn-secondary-sm">
            {dict.games.newGame}
          </button>
        </div>

        <p className="text-xs text-[var(--fg-muted)]">{dict.games.snake.hint}</p>

        <div
          className="relative grid w-full max-w-sm gap-px rounded-xl bg-[var(--border)]/40 p-1.5"
          style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0, 1fr))` }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {Array.from({ length: GRID * GRID }).map((_, i) => {
            const x = i % GRID;
            const y = Math.floor(i / GRID);
            const cell = snakeCells.get(`${x},${y}`);
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={i}
                className={`aspect-square rounded-[2px] ${
                  cell === "head"
                    ? "bg-accent-600"
                    : cell === "body"
                      ? "bg-accent-500/70"
                      : isFood
                        ? "bg-sun-500"
                        : "bg-[var(--bg)]/60"
                }`}
              />
            );
          })}

          {status === "over" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-[var(--bg)]/85 backdrop-blur-sm">
              <p className="text-lg font-bold">{dict.games.gameOver}</p>
              <button type="button" onClick={resetGame} className="btn-primary">
                {dict.games.playAgain}
              </button>
            </div>
          )}
        </div>

        <div className="mt-1 grid grid-cols-3 gap-1.5 sm:hidden">
          <span />
          <button
            type="button"
            onClick={() => trySetDirection(0, -1)}
            className="btn-secondary-sm flex h-11 w-11 items-center justify-center text-lg"
            aria-label="up"
          >
            ▲
          </button>
          <span />
          <button
            type="button"
            onClick={() => trySetDirection(-1, 0)}
            className="btn-secondary-sm flex h-11 w-11 items-center justify-center text-lg"
            aria-label="left"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => trySetDirection(0, 1)}
            className="btn-secondary-sm flex h-11 w-11 items-center justify-center text-lg"
            aria-label="down"
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => trySetDirection(1, 0)}
            className="btn-secondary-sm flex h-11 w-11 items-center justify-center text-lg"
            aria-label="right"
          >
            ▶
          </button>
        </div>
      </div>
    </AppShell>
  );
}
