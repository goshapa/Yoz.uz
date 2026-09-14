"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, type UserMe } from "@/lib/api";
import { HANGMAN_KEYBOARDS, HANGMAN_WORDS } from "@/lib/hangmanWords";
import { useI18n } from "@/lib/i18n";

const MAX_WRONG = 6;

function pickWord(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

function GallowsFigure({ wrong }: { wrong: number }) {
  return (
    <svg viewBox="0 0 100 100" width={110} height={110} className="text-[var(--fg)]">
      <g fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
        <line x1="10" y1="95" x2="60" y2="95" />
        <line x1="25" y1="95" x2="25" y2="10" />
        <line x1="25" y1="10" x2="65" y2="10" />
        <line x1="65" y1="10" x2="65" y2="22" />
        {wrong >= 1 && <circle cx="65" cy="30" r="8" />}
        {wrong >= 2 && <line x1="65" y1="38" x2="65" y2="65" />}
        {wrong >= 3 && <line x1="65" y1="45" x2="53" y2="58" />}
        {wrong >= 4 && <line x1="65" y1="45" x2="77" y2="58" />}
        {wrong >= 5 && <line x1="65" y1="65" x2="55" y2="82" />}
        {wrong >= 6 && <line x1="65" y1="65" x2="75" y2="82" />}
      </g>
    </svg>
  );
}

export default function HangmanPage() {
  const { dict, locale } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [round, setRound] = useState(0);
  // Инициализируем детерминированно (совпадает с серверным рендером), а
  // выбираем настоящее случайное слово только после монтирования — иначе
  // Math.random() во время рендера ломает гидратацию (уже наступали на эти
  // грабли в викторине).
  const [word, setWord] = useState(() => HANGMAN_WORDS[locale][0]);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setWord(pickWord(HANGMAN_WORDS[locale]));
    setGuessed(new Set());
  }, [locale, round]);

  const letters = Array.from(word);
  const wrongGuesses = Array.from(guessed).filter((l) => !letters.includes(l));
  const wrongCount = wrongGuesses.length;
  const won = letters.every((l) => guessed.has(l));
  const lost = wrongCount >= MAX_WRONG;
  const over = won || lost;

  const guessLetter = useCallback(
    (letter: string) => {
      if (over || guessed.has(letter)) return;
      setGuessed((current) => new Set(current).add(letter));
    },
    [over, guessed]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const letter = e.key.toUpperCase();
      if (HANGMAN_KEYBOARDS[locale].includes(letter)) guessLetter(letter);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locale, guessLetter]);

  function newRound() {
    setRound((r) => r + 1);
  }

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href="/games" className="text-sm font-bold text-[var(--fg-muted)] hover:underline">
          ← {dict.games.back}
        </Link>
        <h1 className="min-w-0 truncate font-medium">{dict.games.hangman.title}</h1>
      </header>
      <div className="border-b border-[var(--border)]" />

      <div className="flex flex-col items-center gap-4 px-4 py-6">
        <GallowsFigure wrong={wrongCount} />

        <p className="text-xs font-semibold text-[var(--fg-muted)]">
          {dict.games.hangman.attemptsLeft}: {Math.max(0, MAX_WRONG - wrongCount)}/{MAX_WRONG}
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {letters.map((letter, i) => (
            <span
              key={i}
              className="flex h-10 w-8 items-center justify-center border-b-2 border-[var(--border)] text-xl font-extrabold"
            >
              {guessed.has(letter) || over ? letter : ""}
            </span>
          ))}
        </div>

        {over && (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="font-bold">{won ? dict.games.youWin : dict.games.youLose}</p>
            {!won && (
              <p className="text-sm text-[var(--fg-muted)]">
                {dict.games.hangman.wordWas}: <span className="font-bold">{word}</span>
              </p>
            )}
            <button type="button" onClick={newRound} className="btn-primary mt-1">
              {dict.games.playAgain}
            </button>
          </div>
        )}

        {!over && (
          <div className="grid max-w-md grid-cols-7 gap-1.5 sm:grid-cols-9">
            {HANGMAN_KEYBOARDS[locale].map((letter) => {
              const isGuessed = guessed.has(letter);
              const isHit = isGuessed && letters.includes(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => guessLetter(letter)}
                  disabled={isGuessed}
                  className={`flex h-9 w-9 items-center justify-center rounded-md border-[1.5px] text-sm font-bold transition ${
                    isGuessed
                      ? isHit
                        ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                        : "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400"
                      : "border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
