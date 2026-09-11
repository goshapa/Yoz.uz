"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PostCard } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { LoadingState } from "@/components/Spinner";
import { api, type FeedPage, type Post, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function PostDetailPage() {
  const { dict } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;

  const [user, setUser] = useState<UserMe | null>(null);
  const [post, setPost] = useState<Post | null | "not-found">(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setPost(null);
    setReplies([]);

    api
      .get<Post>(`/posts/${postId}`)
      .then(setPost)
      .catch(() => setPost("not-found"));

    api
      .get<FeedPage>(`/posts/${postId}/replies`)
      .then((page) => {
        setReplies(page.items);
        setNextCursor(page.next_cursor);
      })
      .catch(() => setReplies([]));
  }, [postId]);

  async function loadMoreReplies() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.get<FeedPage>(
        `/posts/${postId}/replies?cursor=${encodeURIComponent(nextCursor)}`
      );
      setReplies((current) => [...current, ...page.items]);
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleReplySubmitted(reply: Post) {
    setReplies((current) => [...current, reply]);
    setPost((current) =>
      current && current !== "not-found"
        ? { ...current, replies_count: current.replies_count + 1 }
        : current
    );
  }

  return (
    <AppShell user={user}>
      <header className="sticky top-[env(safe-area-inset-top)] z-10 flex items-center gap-3 bg-[var(--bg)]/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition hover:bg-black/5 dark:hover:bg-white/5"
          aria-label={dict.postDetail.back}
        >
          ←
        </button>
        <span className="font-semibold">{dict.postDetail.repliesTitle}</span>
      </header>

      {post === null && (
        <LoadingState label={dict.common.loading} />
      )}
      {post === "not-found" && (
        <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.postDetail.notFound}</div>
      )}
      {post && post !== "not-found" && (
        <>
          <PostCard post={post} currentUsername={user?.username} onDeleted={() => router.push("/")} />

          {user && (
            <div className="card mx-3 my-2.5 p-4">
              <PostComposer parentPostId={post.id} replyTo={post.author} onSubmitted={handleReplySubmitted} />
            </div>
          )}

          {replies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-500/15 text-accent-600 dark:text-accent-400">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--fg-muted)]">{dict.postDetail.noReplies}</p>
            </div>
          ) : (
            replies.map((reply) => (
              <PostCard
                key={reply.id}
                post={reply}
                currentUsername={user?.username}
                onDeleted={() => setReplies((current) => current.filter((r) => r.id !== reply.id))}
              />
            ))
          )}

          {nextCursor && (
            <div className="py-4 text-center">
              <button
                type="button"
                onClick={loadMoreReplies}
                className="btn-secondary-sm"
                disabled={loadingMore}
              >
                {loadingMore ? dict.feed.loadingMore : dict.feed.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
