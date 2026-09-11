import type { Locale } from "@/lib/i18n";

const INTL_LOCALE: Record<Locale, string> = {
  ru: "ru-RU",
  uz: "uz-UZ",
  en: "en-US",
};

export function formatRelativeTime(iso: string, locale: Locale): string {
  const date = new Date(iso);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < 5) return locale === "ru" ? "только что" : locale === "uz" ? "hozirgina" : "just now";
  if (diffSec < 60) return locale === "ru" ? `${diffSec} с` : locale === "uz" ? `${diffSec} soniya` : `${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return locale === "ru" ? `${diffMin} мин` : locale === "uz" ? `${diffMin} daq` : `${diffMin}m`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return locale === "ru" ? `${diffHour} ч` : locale === "uz" ? `${diffHour} soat` : `${diffHour}h`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return locale === "ru" ? `${diffDay} д` : locale === "uz" ? `${diffDay} kun` : `${diffDay}d`;

  return date.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short" });
}
