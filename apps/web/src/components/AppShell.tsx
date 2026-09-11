"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminSidebar } from "@/components/AdminSidebar";
import { Icon, type IconName } from "@/components/icons";
import { PostComposer } from "@/components/PostComposer";
import { SettingsMenu } from "@/components/SettingsMenu";
import { api, type Post, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const UNREAD_POLL_MS = 30000;

export function AppShell({
  user,
  children,
  onPostCreated,
}: {
  user: UserMe | null;
  children: React.ReactNode;
  onPostCreated?: (post: Post) => void;
}) {
  const { dict } = useI18n();
  const pathname = usePathname();
  const [composerOpen, setComposerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    function poll() {
      api
        .get<{ count: number }>("/notifications/unread-count")
        .then((res) => {
          if (!cancelled) setUnreadCount(res.count);
        })
        .catch(() => undefined);
      api
        .get<{ count: number }>("/messages/unread-count")
        .then((res) => {
          if (!cancelled) setUnreadMessages(res.count);
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
    if (pathname === "/notifications") setUnreadCount(0);
    if (pathname.startsWith("/messages")) setUnreadMessages(0);
  }, [pathname]);

  // Открытая переписка — на мобильном разворачивается на весь экран, без нижней
  // панели (как в большинстве мессенджеров): список диалогов /messages её ещё
  // показывает, а конкретный чат /messages/username — уже нет.
  const isConversationView = pathname.startsWith("/messages/");

  // Чат — по центру нижней панели на мобильном (индекс 2 из 5).
  const navItems: { href: string; label: string; icon: IconName; badge?: number }[] = [
    { href: "/", label: dict.nav.home, icon: "home" },
    { href: "/search", label: dict.nav.search, icon: "search" },
    { href: "/messages", label: dict.nav.messages, icon: "message-circle", badge: unreadMessages },
    { href: "/notifications", label: dict.nav.notifications, icon: "bell", badge: unreadCount },
    { href: user ? `/u/${user.username}` : "/login", label: dict.nav.profile, icon: "user" },
  ];

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl">
      <div className="bg-mesh">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-accent-500/[0.07] blur-2xl" />
        <div className="absolute -right-40 top-1/3 h-80 w-80 rounded-full bg-sun-500/[0.05] blur-2xl" />
      </div>

      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col px-3 py-4 md:flex">
        <div>
          <div className="mb-6 flex items-center justify-between px-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="logo-mark h-8 w-8 text-base">Y</span>
              <span className="text-gradient text-2xl font-extrabold tracking-tight">{dict.common.appName}</span>
            </Link>
            <SettingsMenu align="right" />
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-lg px-3 py-2 text-sm font-bold transition ${
                  pathname === item.href
                    ? "bg-accent-500/10 text-accent-600 shadow-sm border border-accent-500/20 dark:text-accent-400"
                    : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <span className="mr-2 inline-flex align-middle" aria-hidden>
                  <Icon name={item.icon} size={18} />
                </span>
                {item.label}
                {!!item.badge && (
                  <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sun-500 px-1 text-[10px] font-semibold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            ))}
            {user && user.role !== "user" && (
              <Link
                href="/admin"
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                  pathname.startsWith("/admin")
                    ? "bg-accent-500/10 text-accent-600 shadow-sm border border-accent-500/20 dark:text-accent-400"
                    : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <span className="mr-2 inline-flex align-middle" aria-hidden>
                  <Icon name="shield" size={18} />
                </span>
                {dict.nav.admin}
              </Link>
            )}
          </nav>
          {user && (
            <button type="button" onClick={() => setComposerOpen(true)} className="btn-primary mt-4 w-full">
              {dict.composer.submit}
            </button>
          )}
        </div>
      </aside>

      <div
        className={`flex min-h-screen w-full flex-1 flex-col md:max-w-2xl md:pb-0 ${
          isConversationView ? "pb-0" : "pb-16"
        }`}
      >
        {children}
      </div>

      <aside className="hidden w-72 shrink-0 lg:block">
        {user && user.role !== "user" && <AdminSidebar />}
      </aside>

      {!isConversationView && (
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[var(--border)] bg-[var(--bg-elevated)] md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                pathname === item.href ? "text-accent-600 dark:text-accent-400" : "text-[var(--fg-muted)]"
              }`}
            >
              <span className="relative" aria-hidden>
                <Icon name={item.icon} size={21} />
                {!!item.badge && (
                  <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-sun-500" />
                )}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {user && !pathname.startsWith("/messages") && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="btn-primary fixed bottom-16 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full text-2xl leading-none shadow-lg md:hidden"
          aria-label={dict.composer.submit}
        >
          +
        </button>
      )}

      {composerOpen && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10"
          onClick={() => setComposerOpen(false)}
        >
          <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <PostComposer
              onSubmitted={(post) => {
                setComposerOpen(false);
                onPostCreated?.(post);
              }}
              onCancel={() => setComposerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
