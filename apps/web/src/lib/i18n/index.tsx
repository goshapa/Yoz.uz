"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { Dictionary } from "./locales/ru";
import en from "./locales/en";
import ru from "./locales/ru";
import uz from "./locales/uz";

export type Locale = "ru" | "uz" | "en";

const dictionaries: Record<Locale, Dictionary> = { ru, uz, en };

const STORAGE_KEY = "yoz-locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: Dictionary;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ru" || stored === "uz" || stored === "en") {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo(
    () => ({ locale, setLocale, dict: dictionaries[locale] }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function topicName(topic: { name_ru: string; name_uz: string; name_en: string }, locale: Locale): string {
  if (locale === "uz") return topic.name_uz;
  if (locale === "en") return topic.name_en;
  return topic.name_ru;
}

// Русское склонение: 1 участник, 2-4 участника, 0/5-20 участников (11-14 —
// всегда "участников", несмотря на последнюю цифру).
function ruPluralForm(n: number): "one" | "few" | "many" {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "few";
  return "many";
}

export function formatMembersCount(count: number, locale: Locale): string {
  if (locale === "uz") return `${count} a'zo`;
  if (locale === "en") return `${count} ${count === 1 ? "member" : "members"}`;
  const forms = { one: "участник", few: "участника", many: "участников" } as const;
  return `${count} ${forms[ruPluralForm(count)]}`;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n должен использоваться внутри I18nProvider");
  }
  return ctx;
}
