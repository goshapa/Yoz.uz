"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon } from "@/components/icons";
import { Lightbox } from "@/components/Lightbox";
import { ReportModal } from "@/components/ReportModal";
import { api, type Post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/time";

function ImageGrid({ images, onOpen }: { images: Post["images"]; onOpen: (index: number) => void }) {
  if (images.length === 0) return null;

  const gridClass =
    images.length === 1
      ? "grid-cols-1"
      : images.length === 2
        ? "grid-cols-2"
        : images.length === 3
          ? "grid-cols-2"
          : "grid-cols-2";

  return (
    <div className={`mt-2 grid gap-1 overflow-hidden rounded-xl ${gridClass}`}>
      {images.map((image, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.id}
          src={image.thumbnail_url}
          alt={image.alt_text ?? ""}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(index);
          }}
          className={`h-48 w-full cursor-pointer object-cover ${
            images.length === 3 && index === 0 ? "col-span-2" : ""
          }`}
        />
      ))}
    </div>
  );
}

export function PostCard({
  post,
  currentUsername,
  onDeleted,
}: {
  post: Post;
  currentUsername?: string;
  onDeleted?: (postId: string) => void;
}) {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [state, setState] = useState(post);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isOwner = currentUsername === state.author.username;

  function goToPost() {
    router.push(`/post/${state.id}`);
  }

  function applyToggle(prev: Post, kind: "like" | "repost" | "bookmark", active: boolean): Post {
    const delta = active ? 1 : -1;
    switch (kind) {
      case "like":
        return { ...prev, liked_by_viewer: active, likes_count: prev.likes_count + delta };
      case "repost":
        return { ...prev, reposted_by_viewer: active, reposts_count: prev.reposts_count + delta };
      case "bookmark":
        return { ...prev, bookmarked_by_viewer: active };
    }
  }

  function isActive(kind: "like" | "repost" | "bookmark"): boolean {
    if (kind === "like") return state.liked_by_viewer;
    if (kind === "repost") return state.reposted_by_viewer;
    return state.bookmarked_by_viewer;
  }

  async function toggle(kind: "like" | "repost" | "bookmark") {
    if (busy) return;
    setBusy(true);

    const wasActive = isActive(kind);
    setState((prev) => applyToggle(prev, kind, !wasActive));

    try {
      if (wasActive) {
        await api.del(`/posts/${state.id}/${kind}`);
      } else {
        await api.post(`/posts/${state.id}/${kind}`);
      }
    } catch {
      setState((prev) => applyToggle(prev, kind, wasActive));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/post/${state.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // буфер обмена недоступен — молча игнорируем
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await api.del(`/posts/${state.id}`);
      onDeleted?.(state.id);
    } catch {
      setConfirmingDelete(false);
    }
  }

  return (
    <article className="card mx-3 my-2.5 px-4 py-3.5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/[0.06]">
      {state.reposted_by && (
        <p className="mb-1 flex items-center gap-1 pl-8 text-xs text-[var(--fg-muted)]">
          <span>🔁</span>
          <Link href={`/u/${state.reposted_by.username}`} className="hover:underline">
            {state.reposted_by.display_name}
          </Link>
          <span>{dict.post.reposted}</span>
        </p>
      )}

      <div className="flex gap-3">
        <Link href={`/u/${state.author.username}`} onClick={(e) => e.stopPropagation()}>
          <Avatar src={state.author.avatar_url} name={state.author.display_name} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-1 text-sm">
            <Link
              href={`/u/${state.author.username}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 font-semibold hover:underline"
            >
              {state.author.display_name}
              {state.author.is_founder && <FounderBadge />}
            </Link>
            <span className="text-[var(--fg-muted)]">@{state.author.username}</span>
            <span className="text-[var(--fg-muted)]">·</span>
            <span className="text-[var(--fg-muted)]">{formatRelativeTime(state.created_at, locale)}</span>
          </div>

          {state.reply_to && (
            <p className="text-xs text-[var(--fg-muted)]">
              {dict.composer.replyingTo} <span className="text-accent-600 dark:text-accent-400">@{state.reply_to.username}</span>
            </p>
          )}

          <div onClick={goToPost} className="cursor-pointer">
            {state.text && <p className="mt-1 whitespace-pre-wrap break-words text-[15px]">{state.text}</p>}
            <ImageGrid images={state.images} onOpen={(index) => setLightboxIndex(index)} />
            {state.video_url && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(0);
                }}
                className="group relative mt-2 cursor-pointer overflow-hidden rounded-xl bg-black"
              >
                <video src={state.video_url} preload="metadata" muted className="max-h-96 w-full" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/20">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 text-white">
                    <Icon name="play" size={22} filled />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex max-w-md items-center justify-between text-[var(--fg)]">
            <button
              type="button"
              onClick={() => goToPost()}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-base hover:bg-accent-500/10 hover:text-accent-600 dark:hover:text-accent-400"
              title={dict.post.reply}
            >
              <Icon name="reply" /> <span className="text-sm font-medium">{state.replies_count > 0 && state.replies_count}</span>
            </button>
            <button
              type="button"
              onClick={() => toggle("repost")}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-base hover:bg-emerald-500/10 hover:text-emerald-600 ${
                state.reposted_by_viewer ? "text-emerald-600" : ""
              }`}
              title={state.reposted_by_viewer ? dict.post.unrepost : dict.post.repost}
            >
              <Icon name="repost" /> <span className="text-sm font-medium">{state.reposts_count > 0 && state.reposts_count}</span>
            </button>
            <button
              type="button"
              onClick={() => toggle("like")}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-base hover:bg-rose-500/10 hover:text-rose-600 ${
                state.liked_by_viewer ? "text-rose-600" : ""
              }`}
              title={state.liked_by_viewer ? dict.post.unlike : dict.post.like}
            >
              <Icon name="heart" filled={state.liked_by_viewer} />{" "}
              <span className="text-sm font-medium">{state.likes_count > 0 && state.likes_count}</span>
            </button>
            <button
              type="button"
              onClick={() => toggle("bookmark")}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-base hover:bg-accent-500/10 hover:text-accent-600 ${
                state.bookmarked_by_viewer ? "text-accent-600" : ""
              }`}
              title={state.bookmarked_by_viewer ? dict.post.unbookmark : dict.post.bookmark}
            >
              <Icon name="bookmark" filled={state.bookmarked_by_viewer} />
            </button>
            <button
              type="button"
              onClick={copyLink}
              className={`relative flex items-center gap-1.5 rounded-full px-2 py-1 text-base hover:bg-accent-500/10 hover:text-accent-600 ${
                linkCopied ? "text-accent-600" : ""
              }`}
              title={dict.post.copyLink}
            >
              <Icon name={linkCopied ? "check" : "link"} />
              {linkCopied && (
                <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--fg)] px-2 py-1 text-[11px] font-medium text-[var(--bg)] shadow-md">
                  {dict.post.linkCopied}
                </span>
              )}
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-base hover:bg-red-500/10 hover:text-red-600 ${
                  confirmingDelete ? "text-red-600" : ""
                }`}
                title={dict.post.delete}
              >
                {confirmingDelete ? <span className="text-sm font-medium">{dict.post.deleteConfirm}</span> : <Icon name="trash" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-base hover:bg-red-500/10 hover:text-red-600"
                title={dict.post.report}
              >
                <Icon name="flag" />
              </button>
            )}
          </div>
        </div>
      </div>

      {reportOpen && <ReportModal targetType="post" targetId={state.id} onClose={() => setReportOpen(false)} />}

      {lightboxIndex !== null && (
        <Lightbox
          items={
            state.images.length > 0
              ? state.images.map((img) => ({ type: "image" as const, url: img.url, alt: img.alt_text ?? undefined }))
              : state.video_url
                ? [{ type: "video" as const, url: state.video_url }]
                : []
          }
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </article>
  );
}
