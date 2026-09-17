"use client";

import Link from "next/link";

import { useI18n } from "@/lib/i18n";

import { SettingsMenu } from "./SettingsMenu";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { dict } = useI18n();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex w-full max-w-sm items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="logo-mark h-8 w-8 text-base">Y</span>
          <span className="text-gradient text-2xl font-extrabold tracking-tight">{dict.common.appName}</span>
        </Link>
        <SettingsMenu align="right" />
      </div>

      <div className="card relative w-full max-w-sm p-6">
        <h1 className="mb-1 text-lg font-semibold">{title}</h1>
        <p className="mb-6 text-xs text-[var(--fg-muted)]">{dict.common.slogan}</p>
        {children}
      </div>
    </div>
  );
}
