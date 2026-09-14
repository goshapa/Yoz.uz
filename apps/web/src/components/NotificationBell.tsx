"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const UNREAD_POLL_MS = 30000;

// Маленькая квадратная кнопка уведомлений — того же размера/стиля, что и
// шестерёнка настроек (SettingsMenu), поэтому ставится рядом с ней в шапке
// (на мобильном — в шапке главной страницы, на десктопе — в сайдбаре).
export function NotificationBell({ user }: { user: UserMe | null }) {
  const { dict } = useI18n();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    function poll() {
      api
        .get<{ count: number }>("/notifications/unread-count")
        .then((res) => {
          if (!cancelled) setCount(res.count);
        })
        .catch(() => undefined);
    }
    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (pathname === "/notifications") setCount(0);
  }, [pathname]);

  if (!user) return null;

  return (
    <Link
      href="/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border-[1.5px] border-[var(--border)] transition hover:border-accent-600 hover:bg-accent-500/5"
      aria-label={dict.nav.notifications}
    >
      <Icon name="bell" size={17} />
      {!!count && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun-500 px-1 text-[10px] font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
