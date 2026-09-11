"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PostCard } from "@/components/PostCard";
import { LoadingState } from "@/components/Spinner";
import { api, type FeedPage, type Post } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const NEW_POSTS_POLL_MS = 30000;

export function FeedList({
  endpoint,
  emptyMessage,
  currentUsername,
  storageKey,
  injectedPost,
}: {
  endpoint: string;
  emptyMessage: string;
  currentUsername?: string;
  storageKey: string;
  injectedPost?: Post | null;
}) {
  const { dict } = useI18n();
  const [items, setItems] = useState<Post[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const latestIdRef = useRef<string | null>(null);
  const injectedIdRef = useRef<string | null>(null);

  const load = useCallback(
    (cursor?: string) => {
      const query = cursor ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}` : endpoint;
      return api.get<FeedPage>(query);
    },
    [endpoint]
  );

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setHasNewer(false);

    load()
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.next_cursor);
        latestIdRef.current = page.items[0]?.id ?? null;

        const savedScroll = sessionStorage.getItem(`scroll:${storageKey}`);
        if (savedScroll) {
          requestAnimationFrame(() => window.scrollTo(0, Number(savedScroll)));
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [load, storageKey]);

  useEffect(() => {
    function saveScroll() {
      sessionStorage.setItem(`scroll:${storageKey}`, String(window.scrollY));
    }
    window.addEventListener("beforeunload", saveScroll);
    return () => {
      saveScroll();
      window.removeEventListener("beforeunload", saveScroll);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!injectedPost || injectedIdRef.current === injectedPost.id) return;
    injectedIdRef.current = injectedPost.id;
    setItems((current) => [injectedPost, ...(current ?? [])]);
    latestIdRef.current = injectedPost.id;
  }, [injectedPost]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await load(nextCursor);
      setItems((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!latestIdRef.current) return;
      try {
        const page = await load();
        if (page.items[0] && page.items[0].id !== latestIdRef.current) {
          setHasNewer(true);
        }
      } catch {
        // фоновая проверка — молча пропускаем сбой сети
      }
    }, NEW_POSTS_POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function showNewer() {
    const page = await load();
    setItems(page.items);
    setNextCursor(page.next_cursor);
    latestIdRef.current = page.items[0]?.id ?? null;
    setHasNewer(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDeleted(postId: string) {
    setItems((current) => current?.filter((p) => p.id !== postId) ?? null);
  }

  if (items === null) {
    return <LoadingState label={dict.common.loading} />;
  }

  return (
    <div>
      {hasNewer && (
        <div className="sticky top-0 z-10 flex justify-center py-2">
          <button
            type="button"
            onClick={showNewer}
            className="rounded-full bg-accent-500 px-4 py-1.5 text-xs font-medium text-white shadow-md hover:bg-accent-600"
          >
            {dict.feed.newPosts}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-500/15 text-accent-600 dark:text-accent-400">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--fg-muted)]">{emptyMessage}</p>
        </div>
      ) : (
        items.map((post) => (
          <PostCard key={post.id} post={post} currentUsername={currentUsername} onDeleted={handleDeleted} />
        ))
      )}

      <div ref={sentinelRef} className="h-1" />
      {loadingMore && (
        <div className="py-4 text-center text-xs text-[var(--fg-muted)]">{dict.feed.loadingMore}</div>
      )}
    </div>
  );
}
