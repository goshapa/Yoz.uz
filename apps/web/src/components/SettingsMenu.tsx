"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { useI18n, type Locale } from "@/lib/i18n";

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: "uz", label: "O‘zbekcha" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export function SettingsMenu({ align = "left" }: { align?: "left" | "right" }) {
  const { locale, setLocale, dict } = useI18n();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const isDark = theme === "dark";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px] border-[var(--border)] transition hover:border-accent-600 hover:bg-accent-500/5"
        aria-label={dict.common.settings}
        aria-expanded={open}
      >
        <Icon name="settings" size={17} />
      </button>

      {open && (
        <div
          className={`card absolute top-full z-30 mt-2 w-48 p-2 text-sm ${align === "right" ? "right-0" : "left-0"}`}
        >
          <p className="label px-2 pt-1">{dict.common.language}</p>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              type="button"
              onClick={() => {
                setLocale(lang.value);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-2 py-1.5 text-left font-semibold transition ${
                locale === lang.value
                  ? "bg-accent-500/10 text-accent-700 dark:text-accent-300"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {lang.label}
            </button>
          ))}

          <div className="my-2 border-t-[1.5px] border-[var(--border)]" />

          <p className="label px-2">{dict.common.theme}</p>
          <button
            type="button"
            onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span>{mounted ? (isDark ? dict.common.themeDark : dict.common.themeLight) : ""}</span>
            <span className="text-sun-500" aria-hidden>
              <Icon name={mounted && isDark ? "moon" : "sun"} size={16} />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
