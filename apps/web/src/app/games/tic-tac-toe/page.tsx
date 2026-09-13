"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Cell = "X" | "O" | null;
type Board = Cell[];

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function winnerOf(board: Board): Cell {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function pickComputerMove(board: Board): number {
  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);

  for (const i of empty) {
    const copy = [...board];
    copy[i] = "O";
    if (winnerOf(copy) === "O") return i;
  }
  for (const i of empty) {
    const copy = [...board];
    copy[i] = "X";
    if (winnerOf(copy) === "X") return i;
  }
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => empty.includes(i));
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return empty[Math.floor(Math.random() * empty.length)];
}

export default function TicTacToePage() {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [turn, setTurn] = useState<"player" | "computer">("player");

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const winner = winnerOf(board);
  const isDraw = !winner && board.every((c) => c !== null);
  const gameOver = Boolean(winner) || isDraw;

  useEffect(() => {
    if (turn !== "computer" || gameOver) return;
    const timeout = setTimeout(() => {
      setBoard((current) => {
        if (winnerOf(current) || current.every((c) => c !== null)) return current;
        const move = pickComputerMove(current);
        const next = [...current];
        next[move] = "O";
        return next;
      });
      setTurn("player");
    }, 500);
    return () => clearTimeout(timeout);
  }, [turn, gameOver]);

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null));
    setTurn("player");
  }, []);

  function handleCellClick(index: number) {
    if (turn !== "player" || gameOver || board[index] !== null) return;
    const next = [...board];
    next[index] = "X";
    setBoard(next);
    setTurn("computer");
  }

  let statusText: string;
  if (winner === "X") statusText = dict.games.youWin;
  else if (winner === "O") statusText = dict.games.youLose;
  else if (isDraw) statusText = dict.games.draw;
  else statusText = turn === "player" ? dict.games.ticTacToe.yourTurn : dict.games.ticTacToe.computerTurn;

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href="/games" className="text-sm font-bold text-[var(--fg-muted)] hover:underline">
          ← {dict.games.back}
        </Link>
        <h1 className="min-w-0 truncate font-medium">{dict.games.ticTacToe.title}</h1>
      </header>
      <div className="border-b border-[var(--border)]" />

      <div className="flex flex-col items-center gap-4 px-4 py-8">
        <p className="h-5 text-sm font-semibold text-[var(--fg-muted)]">{statusText}</p>

        <div className="grid grid-cols-3 gap-2">
          {board.map((cell, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleCellClick(i)}
              disabled={cell !== null || turn !== "player" || gameOver}
              className="flex h-20 w-20 items-center justify-center rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] text-4xl font-extrabold shadow-sm transition disabled:cursor-default enabled:hover:bg-black/5 dark:enabled:hover:bg-white/5 sm:h-24 sm:w-24"
            >
              {cell === "X" && <span className="text-accent-600 dark:text-accent-400">X</span>}
              {cell === "O" && <span className="text-sun-500">O</span>}
            </button>
          ))}
        </div>

        {gameOver && (
          <button type="button" onClick={reset} className="btn-primary">
            {dict.games.playAgain}
          </button>
        )}
      </div>
    </AppShell>
  );
}
