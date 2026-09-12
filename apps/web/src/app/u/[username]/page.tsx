"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { FeedList } from "@/components/FeedList";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon } from "@/components/icons";
import { ReportModal } from "@/components/ReportModal";
import { LoadingState } from "@/components/Spinner";
import { api, type Profile, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime, isOnline } from "@/lib/time";

type Tab = "posts" | "replies" | "media";

// Intl.DateTimeFormat с month:"long" даёт именительный падеж ("сентябрь"), а после
// "На сайте с" по-русски нужен родительный ("сентября") — Intl такое не умеет,
// поэтому для ru берём название месяца из своего списка.
const RU_MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatJoinedDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (locale === "ru") {
    return `${RU_MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()} г.`;
  }
  return date.toLocaleDateString(locale === "uz" ? "uz-UZ" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function ProfilePage() {
  const { dict, locale } = useI18n();
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [viewer, setViewer] = useState<UserMe | null>(null);
  const [profile, setProfile] = useState<Profile | null | "not-found">(null);
  const [tab, setTab] = useState<Tab>("posts");
  const [followBusy, setFollowBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setViewer)
      .catch(() => setViewer(null));
  }, []);

  useEffect(() => {
    setProfile(null);
    setTab("posts");
    api
      .get<Profile>(`/users/${username}`)
      .then(setProfile)
      .catch(() => setProfile("not-found"));
  }, [username]);

  async function toggleFollow() {
    if (!profile || profile === "not-found" || followBusy) return;
    setFollowBusy(true);
    const next = !profile.is_following;
    const previous = profile;
    setProfile({ ...profile, is_following: next, followers_count: profile.followers_count + (next ? 1 : -1) });

    try {
      if (next) {
        await api.post(`/users/${username}/follow`);
      } else {
        await api.del(`/users/${username}/follow`);
      }
    } catch {
      setProfile(previous);
    } finally {
      setFollowBusy(false);
    }
  }

  async function toggleBlock() {
    if (!profile || profile === "not-found" || blockBusy) return;
    const next = !profile.is_blocked_by_viewer;
    if (next && !window.confirm(dict.block.confirmBlock)) return;

    setBlockBusy(true);
    const previous = profile;
    setProfile({ ...profile, is_blocked_by_viewer: next, is_following: next ? false : profile.is_following });

    try {
      if (next) {
        await api.post(`/users/${username}/block`);
      } else {
        await api.del(`/users/${username}/block`);
      }
    } catch {
      setProfile(previous);
    } finally {
      setBlockBusy(false);
    }
  }

  const tabLabels: Record<Tab, string> = {
    posts: dict.profile.tabPosts,
    replies: dict.profile.tabReplies,
    media: dict.profile.tabMedia,
  };

  return (
    <AppShell user={viewer}>
      {profile === null && (
        <LoadingState label={dict.common.loading} />
      )}
      {profile === "not-found" && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.profile.notFound}</div>
      )}
      {profile && profile !== "not-found" && (
        <>
          <div className="h-32 w-full bg-accent-500/20">
            {profile.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="px-4 pb-4">
            <div className="-mt-10 flex items-end justify-between">
              <div
                className={
                  profile.is_founder
                    ? "rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 p-[3px] shadow-md shadow-amber-500/30"
                    : "rounded-full ring-4 ring-[var(--bg)] shadow-lg"
                }
              >
                <div className={profile.is_founder ? "rounded-full bg-[var(--bg)] p-1" : ""}>
                  <Avatar src={profile.avatar_url} name={profile.display_name} size={80} />
                </div>
              </div>
              {profile.is_self ? (
                <Link href="/settings" className="btn-secondary mt-10">
                  {dict.profile.editProfile}
                </Link>
              ) : viewer ? (
                <div className="mt-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="btn-secondary-sm"
                    title={dict.post.report}
                  >
                    <Icon name="flag" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleBlock}
                    className="btn-secondary-sm"
                    disabled={blockBusy}
                  >
                    {profile.is_blocked_by_viewer ? dict.block.unblock : dict.block.block}
                  </button>
                  {!profile.is_blocked_by_viewer && (
                    <Link href={`/messages/${profile.username}`} className="btn-secondary-sm" title={dict.profile.message}>
                      <Icon name="message-circle" size={16} />
                    </Link>
                  )}
                  {!profile.is_blocked_by_viewer && (
                    <button
                      type="button"
                      onClick={toggleFollow}
                      className={profile.is_following ? "btn-secondary" : "btn-primary"}
                      disabled={followBusy}
                    >
                      {profile.is_following ? dict.profile.unfollow : dict.profile.follow}
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            <h1 className="mt-2 flex items-center gap-1.5 text-lg font-semibold">
              {profile.display_name}
              {profile.is_founder && <FounderBadge size={12} />}
            </h1>
            <p className="text-sm text-[var(--fg-muted)]">@{profile.username}</p>
            {profile.is_founder && (
              <div className="mt-2">
                <FounderBadge variant="full" label={dict.profile.founderBadge} />
              </div>
            )}
            {profile.bio && <p className="mt-2 whitespace-pre-wrap text-sm">{profile.bio}</p>}

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
              {profile.city && <span>📍 {profile.city}</span>}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer noopener nofollow"
                  className="text-accent-600 dark:text-accent-400"
                >
                  {profile.website}
                </a>
              )}
              <span>
                {dict.profile.joined} {formatJoinedDate(profile.created_at, locale)}
              </span>
              <span className="flex items-center gap-1">
                {isOnline(profile.last_seen_at) ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{dict.common.online}</span>
                  </>
                ) : (
                  `${dict.common.lastSeenAt} ${formatRelativeTime(profile.last_seen_at, locale)}`
                )}
              </span>
            </div>

            <div className="mt-2 flex gap-4 text-sm">
              {profile.is_self ? (
                <>
                  <Link href={`/u/${username}/following`} className="hover:underline">
                    <strong>{profile.following_count}</strong>{" "}
                    <span className="text-[var(--fg-muted)]">{dict.profile.following}</span>
                  </Link>
                  <Link href={`/u/${username}/followers`} className="hover:underline">
                    <strong>{profile.followers_count}</strong>{" "}
                    <span className="text-[var(--fg-muted)]">{dict.profile.followers}</span>
                  </Link>
                </>
              ) : (
                <>
                  <span>
                    <strong>{profile.following_count}</strong>{" "}
                    <span className="text-[var(--fg-muted)]">{dict.profile.following}</span>
                  </span>
                  <span>
                    <strong>{profile.followers_count}</strong>{" "}
                    <span className="text-[var(--fg-muted)]">{dict.profile.followers}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <nav className="mx-4 mb-1 flex gap-1 rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] p-1 shadow-sm">
            {(Object.keys(tabLabels) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                  tab === t
                    ? "bg-accent-600 text-white shadow-md shadow-accent-900/30"
                    : "text-[var(--fg-muted)] hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {tabLabels[t]}
              </button>
            ))}
          </nav>

          <FeedList
            key={`${username}-${tab}`}
            endpoint={`/users/${username}/${tab}`}
            emptyMessage={dict.profile.empty}
            currentUsername={viewer?.username}
            storageKey={`profile-${username}-${tab}`}
          />

          {reportOpen && (
            <ReportModal targetType="profile" targetId={profile.id} onClose={() => setReportOpen(false)} />
          )}
        </>
      )}
    </AppShell>
  );
}
