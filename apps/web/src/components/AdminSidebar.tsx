"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/time";

type Stats = {
  users_count: number;
  posts_count: number;
  open_reports_count: number;
  suspended_users_count: number;
};

type MiniReport = {
  id: string;
  reason: string;
  target_type: "post" | "profile";
  created_at: string;
};

const REASON_KEYS = ["spam", "abuse", "threats", "prohibited_content", "impersonation", "other"] as const;

export function AdminSidebar() {
  const { dict, locale } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<MiniReport[] | null>(null);

  useEffect(() => {
    api
      .get<Stats>("/admin/stats")
      .then(setStats)
      .catch(() => setStats(null));
    api
      .get<{ items: MiniReport[]; next_cursor: string | null }>("/admin/reports?status_filter=open&limit=3")
      .then((page) => setReports(page.items))
      .catch(() => setReports([]));
  }, []);

  return (
    <div className="sticky top-4 space-y-3 px-3 py-4">
      <div className="card p-3.5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Icon name="shield" size={16} className="text-accent-600 dark:text-accent-400" />
          {dict.admin.panelTitle}
        </div>

        {stats ? (
          <div className="grid grid-cols-2 gap-2">
            <StatCell label={dict.admin.statUsers} value={stats.users_count} />
            <StatCell label={dict.admin.statPosts} value={stats.posts_count} />
            <StatCell label={dict.admin.statOpenReports} value={stats.open_reports_count} accent={stats.open_reports_count > 0} />
            <StatCell label={dict.admin.statSuspended} value={stats.suspended_users_count} />
          </div>
        ) : (
          <div className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
        )}

        <Link href="/admin" className="btn-primary-sm mt-3 block text-center">
          {dict.admin.openPanel}
        </Link>
      </div>

      {reports && reports.length > 0 && (
        <div className="card p-3.5">
          <p className="mb-2 text-xs font-bold text-[var(--fg-muted)]">{dict.admin.recentReports}</p>
          <div className="space-y-1">
            {reports.map((r) => (
              <Link
                key={r.id}
                href="/admin"
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="font-medium">
                  {REASON_KEYS.includes(r.reason as (typeof REASON_KEYS)[number])
                    ? dict.report.reasons[r.reason as (typeof REASON_KEYS)[number]]
                    : r.reason}
                </span>
                <span className="shrink-0 text-[var(--fg-muted)]">{formatRelativeTime(r.created_at, locale)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-black/[0.03] p-2.5 dark:bg-white/[0.04]">
      <p className={`text-xl font-extrabold ${accent ? "text-sun-600 dark:text-sun-400" : "text-gradient"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-[var(--fg-muted)]">{label}</p>
    </div>
  );
}
