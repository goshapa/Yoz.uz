"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { QUIZ_QUESTIONS } from "@/lib/quizQuestions";

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function QuizPage() {
  const { dict, locale } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  // Инициализируем неперемешанным порядком (совпадает с серверным рендером),
  // а перемешиваем уже после монтирования — иначе Math.random() во время
  // рендера даёт разные HTML на сервере и клиенте (hydration mismatch).
  const [questions, setQuestions] = useState(() => QUIZ_QUESTIONS[locale]);
  useEffect(() => {
    setQuestions(shuffled(QUIZ_QUESTIONS[locale]));
  }, [locale, round]);
  const total = questions.length;
  const finished = index >= total;
  const question = !finished ? questions[index] : null;

  function selectOption(optionIndex: number) {
    if (selected !== null || !question) return;
    setSelected(optionIndex);
    if (optionIndex === question.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  function playAgain() {
    setRound((r) => r + 1);
    setIndex(0);
    setScore(0);
    setSelected(null);
  }

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <Link href="/games" className="text-sm font-bold text-[var(--fg-muted)] hover:underline">
          ← {dict.games.back}
        </Link>
        <h1 className="min-w-0 truncate font-medium">{dict.games.quiz.title}</h1>
      </header>
      <div className="border-b border-[var(--border)]" />

      <div className="mx-auto max-w-lg px-4 py-6">
        {!finished && question && (
          <>
            <p className="mb-3 text-xs font-semibold text-[var(--fg-muted)]">
              {dict.games.quiz.question} {index + 1}/{total}
            </p>
            <p className="mb-4 text-lg font-bold">{question.question}</p>
            <div className="flex flex-col gap-2">
              {question.options.map((option, i) => {
                const isCorrect = i === question.correctIndex;
                const isChosen = i === selected;
                let style = "border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-black/5 dark:hover:bg-white/5";
                if (selected !== null && isCorrect) {
                  style = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                } else if (selected !== null && isChosen && !isCorrect) {
                  style = "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400";
                }
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectOption(i)}
                    disabled={selected !== null}
                    className={`rounded-lg border-[1.5px] px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-default ${style}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <button type="button" onClick={next} className="btn-primary mt-5 w-full">
                {index + 1 < total ? dict.games.quiz.next : dict.games.quiz.finish}
              </button>
            )}
          </>
        )}

        {finished && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-lg font-bold">{dict.games.quiz.finished}</p>
            <p className="text-sm text-[var(--fg-muted)]">{dict.games.quiz.yourScore}</p>
            <p className="text-3xl font-extrabold text-accent-600 dark:text-accent-400">
              {score} / {total}
            </p>
            <button type="button" onClick={playAgain} className="btn-primary mt-2">
              {dict.games.playAgain}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
