"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { LoadingState } from "@/components/Spinner";
import { api, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/time";

type AdminAuthor = { id: string; display_name: string; username: string; avatar_url: string | null };

type AdminUser = {
  id: string;
  display_name: string;
  username: string;
  email: string;
  avatar_url: string | null;
  role: "user" | "moderator" | "admin";
  is_suspended: boolean;
  suspension_reason: string | null;
  email_verified: boolean;
  is_founder: boolean;
  created_at: string;
};

type AdminReport = {
  id: string;
  reporter: AdminAuthor;
  target_type: "post" | "profile";
  target_post_id: string | null;
  target_user_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "resolved";
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

type AdminTopic = {
  id: string;
  slug: string;
  name_ru: string;
  name_uz: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
};

type Stats = {
  users_count: number;
  posts_count: number;
  open_reports_count: number;
  suspended_users_count: number;
};

type LogEntry = {
  id: string;
  actor: AdminAuthor | null;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
};

type Tab = "reports" | "users" | "topics" | "stats" | "audit";

const REASON_KEYS = ["spam", "abuse", "threats", "prohibited_content", "impersonation", "other"] as const;

function ReportsTab({ isAdmin }: { isAdmin: boolean }) {
  const { dict, locale } = useI18n();
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "">("open");
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setReports(null);
    const qs = statusFilter ? `?status_filter=${statusFilter}` : "";
    api
      .get<{ items: AdminReport[]; next_cursor: string | null }>(`/admin/reports${qs}`)
      .then((page) => setReports(page.items))
      .catch(() => setReports([]));
  }, [statusFilter]);

  async function resolve(id: string) {
    setBusyId(id);
    try {
      await api.post(`/admin/reports/${id}/resolve`, { status: "resolved" });
      setReports((current) => current?.map((r) => (r.id === id ? { ...r, status: "resolved" as const } : r)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  async function hidePost(postId: string) {
    const reason = window.prompt(dict.admin.hideReasonPrompt);
    if (!reason) return;
    await api.post(`/admin/posts/${postId}/hide`, { reason });
    window.alert(dict.admin.actionDone);
  }

  async function suspendUser(userId: string) {
    const reason = window.prompt(dict.admin.suspendReasonPrompt);
    if (!reason) return;
    await api.post(`/admin/users/${userId}/suspend`, { reason });
    window.alert(dict.admin.actionDone);
  }

  async function assignRole(userId: string) {
    const role = window.prompt(dict.admin.rolePrompt, "moderator");
    if (!role) return;
    await api.post(`/admin/users/${userId}/role`, { role });
    window.alert(dict.admin.actionDone);
  }

  return (
    <div>
      <div className="mx-3 mt-3 flex gap-1 rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-sm">
        {(["open", "resolved", ""] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
              statusFilter === s
                ? "bg-accent-600 text-white shadow-sm shadow-accent-900/30"
                : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {s === "open" ? dict.admin.statusOpen : s === "resolved" ? dict.admin.statusResolved : dict.admin.statusAll}
          </button>
        ))}
      </div>

      {reports === null && (
        <LoadingState label={dict.common.loading} />
      )}
      {reports && reports.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.admin.noReports}</div>
      )}

      {reports?.map((r) => (
        <div key={r.id} className="card mx-3 my-2 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {REASON_KEYS.includes(r.reason as (typeof REASON_KEYS)[number])
                ? dict.report.reasons[r.reason as (typeof REASON_KEYS)[number]]
                : r.reason}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                r.status === "open" ? "bg-sun-500/15 text-sun-600" : "bg-emerald-500/15 text-emerald-600"
              }`}
            >
              {r.status === "open" ? dict.admin.statusOpen : dict.admin.statusResolved}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            {dict.admin.reportedBy} @{r.reporter.username} · {formatRelativeTime(r.created_at, locale)}
          </p>
          {r.details && <p className="mt-1 text-xs">{r.details}</p>}

          <div className="mt-2 flex flex-wrap gap-2">
            {r.target_type === "post" && r.target_post_id && (
              <>
                <Link href={`/post/${r.target_post_id}`} className="btn-secondary-sm">
                  {dict.admin.openTarget}
                </Link>
                <button type="button" onClick={() => hidePost(r.target_post_id!)} className="btn-secondary-sm">
                  {dict.admin.hidePost}
                </button>
              </>
            )}
            {r.target_type === "profile" && r.target_user_id && (
              <>
                <button type="button" onClick={() => suspendUser(r.target_user_id!)} className="btn-secondary-sm">
                  {dict.admin.suspendUser}
                </button>
                {isAdmin && (
                  <button type="button" onClick={() => assignRole(r.target_user_id!)} className="btn-secondary-sm">
                    {dict.admin.assignRole}
                  </button>
                )}
              </>
            )}
            {r.status === "open" && (
              <button
                type="button"
                onClick={() => resolve(r.id)}
                disabled={busyId === r.id}
                className="btn-primary-sm"
              >
                {dict.admin.resolve}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const { dict, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setUsers(null);
    const timeout = setTimeout(() => {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      api
        .get<{ items: AdminUser[]; next_cursor: string | null }>(`/admin/users${qs}`)
        .then((page) => {
          setUsers(page.items);
          setNextCursor(page.next_cursor);
        })
        .catch(() => setUsers([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ cursor: nextCursor });
      if (query.trim()) qs.set("q", query.trim());
      const page = await api.get<{ items: AdminUser[]; next_cursor: string | null }>(`/admin/users?${qs.toString()}`);
      setUsers((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleSuspend(u: AdminUser) {
    setBusyId(u.id);
    try {
      if (u.is_suspended) {
        await api.post(`/admin/users/${u.id}/unsuspend`);
        setUsers((current) => current?.map((x) => (x.id === u.id ? { ...x, is_suspended: false, suspension_reason: null } : x)) ?? null);
      } else {
        const reason = window.prompt(dict.admin.suspendReasonPrompt);
        if (!reason) return;
        await api.post(`/admin/users/${u.id}/suspend`, { reason });
        setUsers((current) => current?.map((x) => (x.id === u.id ? { ...x, is_suspended: true, suspension_reason: reason } : x)) ?? null);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function assignRole(u: AdminUser) {
    const role = window.prompt(dict.admin.rolePrompt, u.role);
    if (!role) return;
    setBusyId(u.id);
    try {
      await api.post(`/admin/users/${u.id}/role`, { role });
      setUsers((current) => current?.map((x) => (x.id === u.id ? { ...x, role: role as AdminUser["role"] } : x)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mx-3 mt-3">
        <input
          className="input"
          placeholder={dict.admin.usersSearchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {users === null && <LoadingState label={dict.common.loading} />}
      {users && users.length === 0 && (
        <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">{dict.admin.noUsers}</div>
      )}

      {users?.map((u) => (
        <div key={u.id} className="card mx-3 my-2 flex items-start gap-3 px-4 py-3 text-sm">
          <Avatar src={u.avatar_url} name={u.display_name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/u/${u.username}`} className="font-semibold hover:underline">
                {u.display_name}
              </Link>
              <span className="text-xs text-[var(--fg-muted)]">@{u.username}</span>
              {u.role !== "user" && (
                <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-semibold text-accent-600 dark:text-accent-400">
                  {u.role}
                </span>
              )}
              {u.is_suspended && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                  {dict.admin.statSuspended}
                </span>
              )}
              {!u.email_verified && (
                <span className="rounded-full bg-sun-500/15 px-2 py-0.5 text-[10px] font-semibold text-sun-600">
                  {dict.admin.notVerified}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{u.email}</p>
            {u.is_suspended && u.suspension_reason && (
              <p className="mt-0.5 text-xs text-red-600">{u.suspension_reason}</p>
            )}
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              {dict.profile.joined} {formatRelativeTime(u.created_at, locale)}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleSuspend(u)}
                disabled={busyId === u.id}
                className="btn-secondary-sm"
              >
                {u.is_suspended ? dict.admin.unsuspendUser : dict.admin.suspendUser}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => assignRole(u)}
                  disabled={busyId === u.id}
                  className="btn-secondary-sm"
                >
                  {dict.admin.assignRole}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {nextCursor && (
        <div className="py-4 text-center">
          <button type="button" onClick={loadMore} className="btn-secondary-sm" disabled={loadingMore}>
            {loadingMore ? dict.feed.loadingMore : dict.messages.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}

function TopicsTab() {
  const { dict } = useI18n();
  const [topics, setTopics] = useState<AdminTopic[] | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [newNameRu, setNewNameRu] = useState("");
  const [newNameUz, setNewNameUz] = useState("");
  const [newNameEn, setNewNameEn] = useState("");

  useEffect(() => {
    api
      .get<AdminTopic[]>("/admin/topics")
      .then(setTopics)
      .catch(() => setTopics([]));
  }, []);

  async function toggleActive(topic: AdminTopic) {
    const updated = await api.patch<AdminTopic>(`/admin/topics/${topic.id}`, { is_active: !topic.is_active });
    setTopics((current) => current?.map((t) => (t.id === topic.id ? updated : t)) ?? null);
  }

  async function createTopic(e: React.FormEvent) {
    e.preventDefault();
    const topic = await api.post<AdminTopic>("/admin/topics", {
      slug: newSlug,
      name_ru: newNameRu,
      name_uz: newNameUz,
      name_en: newNameEn,
    });
    setTopics((current) => [...(current ?? []), topic]);
    setNewSlug("");
    setNewNameRu("");
    setNewNameUz("");
    setNewNameEn("");
  }

  return (
    <div className="space-y-2 p-3">
      {topics?.map((t) => (
        <div key={t.id} className="card flex items-center justify-between px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${t.is_active ? "bg-emerald-500" : "bg-[var(--fg-muted)]"}`} />
            {t.name_ru} / {t.name_uz} / {t.name_en} <span className="text-xs text-[var(--fg-muted)]">({t.slug})</span>
          </span>
          <button type="button" onClick={() => toggleActive(t)} className="btn-secondary-sm">
            {t.is_active ? dict.admin.deactivate : dict.admin.activate}
          </button>
        </div>
      ))}

      <form onSubmit={createTopic} className="card space-y-2 p-4">
        <h3 className="text-sm font-semibold">{dict.admin.newTopic}</h3>
        <input className="input" placeholder="slug" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} required />
        <input
          className="input"
          placeholder="Название (ru)"
          value={newNameRu}
          onChange={(e) => setNewNameRu(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Nomi (uz)"
          value={newNameUz}
          onChange={(e) => setNewNameUz(e.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Name (en)"
          value={newNameEn}
          onChange={(e) => setNewNameEn(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary w-full">
          {dict.admin.create}
        </button>
      </form>
    </div>
  );
}

function StatsTab() {
  const { dict } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api
      .get<Stats>("/admin/stats")
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  if (!stats) {
    return <LoadingState label={dict.common.loading} />;
  }

  const rows: [string, number][] = [
    [dict.admin.statUsers, stats.users_count],
    [dict.admin.statPosts, stats.posts_count],
    [dict.admin.statOpenReports, stats.open_reports_count],
    [dict.admin.statSuspended, stats.suspended_users_count],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {rows.map(([label, value]) => (
        <div key={label} className="card p-4">
          <p className="text-gradient text-3xl font-extrabold">{value}</p>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">{label}</p>
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const { dict, locale } = useI18n();
  const [entries, setEntries] = useState<LogEntry[] | null>(null);

  useEffect(() => {
    api
      .get<{ items: LogEntry[]; next_cursor: string | null }>("/admin/audit-log")
      .then((page) => setEntries(page.items))
      .catch(() => setEntries([]));
  }, []);

  return (
    <div>
      {entries === null && (
        <LoadingState label={dict.common.loading} />
      )}
      {entries?.map((e) => (
        <div key={e.id} className="card mx-3 my-1.5 px-4 py-2 text-xs">
          <span className="font-semibold">{e.actor?.display_name ?? "system"}</span>{" "}
          <span className="text-[var(--fg-muted)]">{e.action}</span>{" "}
          <span className="text-[var(--fg-muted)]">{e.target_type}</span>
          {e.reason && <span className="text-[var(--fg-muted)]"> — {e.reason}</span>}
          <span className="block text-[var(--fg-muted)]">{formatRelativeTime(e.created_at, locale)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { dict } = useI18n();
  const [user, setUser] = useState<UserMe | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [tab, setTab] = useState<Tab>("reports");

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckedAuth(true));
  }, []);

  if (checkedAuth && (!user || user.role === "user")) {
    return (
      <AppShell user={user}>
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.errors.loginRequired}</div>
      </AppShell>
    );
  }

  const isAdmin = user?.role === "admin";
  const visibleTabs: Tab[] = isAdmin ? ["reports", "users", "topics", "stats", "audit"] : ["reports", "users"];

  return (
    <AppShell user={user}>
      <header className="sticky top-0 z-10 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <h1 className="font-medium">{dict.nav.admin}</h1>
      </header>
      <nav className="mx-3 mt-3 flex flex-wrap gap-1 rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-sm">
        {visibleTabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition sm:text-sm ${
              tab === t
                ? "bg-accent-600 text-white shadow-md shadow-accent-900/30"
                : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {dict.admin.tabs[t]}
          </button>
        ))}
      </nav>

      {user && tab === "reports" && <ReportsTab isAdmin={isAdmin} />}
      {user && tab === "users" && <UsersTab isAdmin={isAdmin} />}
      {user && tab === "topics" && isAdmin && <TopicsTab />}
      {user && tab === "stats" && isAdmin && <StatsTab />}
      {user && tab === "audit" && isAdmin && <AuditTab />}
    </AppShell>
  );
}
