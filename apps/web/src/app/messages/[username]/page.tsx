"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { DirectMessageBubble } from "@/components/DirectMessageBubble";
import { ForwardModal } from "@/components/ForwardModal";
import { FounderBadge } from "@/components/FounderBadge";
import { Icon } from "@/components/icons";
import { LoadingState, Spinner } from "@/components/Spinner";
import { api, ApiError, type DirectMessage, type DirectMessagePage, type Profile, type UserMe } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

const POLL_MS = 4000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type AttachmentDraft = {
  file: File;
  previewUrl: string;
  kind: "image" | "video";
};

export default function ConversationPage() {
  const { dict } = useI18n();
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = params.username;

  useLockBodyScroll(true);

  const [viewer, setViewer] = useState<UserMe | null>(null);
  const [peer, setPeer] = useState<Profile | null | "not-found">(null);
  const [items, setItems] = useState<DirectMessage[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmingDeleteChat, setConfirmingDeleteChat] = useState(false);

  const [forwardMessage, setForwardMessage] = useState<DirectMessage | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const latestIdRef = useRef<string | null>(null);
  const itemsRef = useRef<DirectMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    itemsRef.current = items ?? [];
  }, [items]);

  useEffect(() => {
    api
      .get<UserMe>("/users/me")
      .then(setViewer)
      .catch(() => setViewer(null));
  }, []);

  useEffect(() => {
    api
      .get<Profile>(`/users/${username}`)
      .then(setPeer)
      .catch(() => setPeer("not-found"));
  }, [username]);

  const loadLatest = useCallback(() => api.get<DirectMessagePage>(`/messages/${username}`), [username]);

  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    loadLatest()
      .then((page) => {
        if (cancelled) return;
        const ordered = [...page.items].reverse();
        setItems(ordered);
        setNextCursor(page.next_cursor);
        latestIdRef.current = ordered[ordered.length - 1]?.id ?? null;
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView());
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [viewer, loadLatest]);

  useEffect(() => {
    if (!viewer) return;
    const interval = setInterval(async () => {
      try {
        const page = await loadLatest();
        // Свежая страница содержит последние N сообщений вместе с их актуальным
        // состоянием (реакции/правки/удаления). Обновляем на месте те, что уже
        // показаны, и добавляем в конец те, которых ещё не было — сообщения,
        // подгруженные кнопкой «Показать ещё» в начале списка, не трогаем.
        const fetchedById = new Map(page.items.map((m) => [m.id, m]));
        const currentIds = new Set(itemsRef.current.map((m) => m.id));
        const newOnes = [...page.items].reverse().filter((m) => !currentIds.has(m.id));
        const hasUpdates = itemsRef.current.some(
          (m) => fetchedById.has(m.id) && fetchedById.get(m.id) !== m
        );

        if (newOnes.length > 0 || hasUpdates) {
          const updatedTail = itemsRef.current.map((m) => fetchedById.get(m.id) ?? m);
          setItems([...updatedTail, ...newOnes]);
        }
        if (newOnes.length > 0) {
          latestIdRef.current = newOnes[newOnes.length - 1].id;
          requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
        }
      } catch {
        // фоновое обновление — молча пропускаем сбой сети
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [viewer, loadLatest]);

  useEffect(() => {
    if (!actionMenuFor) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-message-menu]")) setActionMenuFor(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [actionMenuFor]);

  async function loadOlder() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.get<DirectMessagePage>(
        `/messages/${username}?cursor=${encodeURIComponent(nextCursor)}`
      );
      setItems((current) => [...[...page.items].reverse(), ...(current ?? [])]);
      setNextCursor(page.next_cursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function clearAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(file: File | null) {
    setError(null);
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setError(dict.messages.attachmentUnsupported);
      return;
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setError(dict.messages.attachmentTooBig);
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setError(dict.messages.attachmentTooBig);
      return;
    }
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({ file, previewUrl: URL.createObjectURL(file), kind: isImage ? "image" : "video" });
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || sending) return;
    setError(null);
    setSending(true);
    try {
      const formData = new FormData();
      if (trimmed) formData.append("text", trimmed);
      if (replyTo) formData.append("reply_to_id", replyTo.id);
      if (attachment) formData.append("attachment", attachment.file);
      const message = await api.postForm<DirectMessage>(`/messages/${username}`, formData);
      setItems((current) => [...(current ?? []), message]);
      latestIdRef.current = message.id;
      setText("");
      setReplyTo(null);
      clearAttachment();
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSending(false);
    }
  }

  function startEdit(message: DirectMessage) {
    setActionMenuFor(null);
    setReplyTo(null);
    setEditingId(message.id);
    setEditText(message.text ?? "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    try {
      const updated = await api.patch<DirectMessage>(`/messages/${username}/${editingId}`, { text: trimmed });
      setItems((current) => current?.map((m) => (m.id === updated.id ? updated : m)) ?? null);
      setEditingId(null);
      setEditText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    }
  }

  async function handleDeleteMessage(message: DirectMessage) {
    setActionMenuFor(null);
    try {
      await api.del(`/messages/${username}/${message.id}`);
      setItems(
        (current) =>
          current?.map((m) =>
            m.id === message.id
              ? { ...m, is_deleted: true, text: null, attachment_url: null, attachment_type: null, reactions: [] }
              : m
          ) ?? null
      );
    } catch {
      // молча игнорируем — сообщение просто останется как было
    }
  }

  async function toggleReaction(message: DirectMessage, emoji: string) {
    setActionMenuFor(null);
    const mine = message.reactions.find((r) => r.reacted_by_viewer);
    try {
      const updated =
        mine && mine.emoji === emoji
          ? await api.del<DirectMessage>(`/messages/${username}/${message.id}/reactions`)
          : await api.put<DirectMessage>(`/messages/${username}/${message.id}/reactions`, { emoji });
      setItems((current) => current?.map((m) => (m.id === updated.id ? updated : m)) ?? null);
    } catch {
      // молча игнорируем сбой реакции
    }
  }

  async function handleDeleteChat() {
    if (!confirmingDeleteChat) {
      setConfirmingDeleteChat(true);
      return;
    }
    try {
      await api.del(`/messages/${username}`);
    } finally {
      router.push("/messages");
    }
  }

  const blocked = peer !== null && peer !== "not-found" && peer.is_blocked_by_viewer;

  return (
    <AppShell user={viewer}>
      {/* fixed на мобильном — страница жёстко привязана к вьюпорту, её нельзя утянуть
          вместе со всем интерфейсом; на десктопе остаётся обычным блоком в колонке. */}
      <div className="fixed inset-0 z-20 flex flex-col overscroll-none bg-[var(--bg)] md:static md:inset-auto md:z-auto md:h-[100dvh]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
          <Link href="/messages" className="btn-secondary-sm shrink-0" aria-label={dict.postDetail.back}>
            ←
          </Link>
          {peer && peer !== "not-found" && (
            <Link href={`/u/${peer.username}`} className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar src={peer.avatar_url} name={peer.display_name} size={32} />
              <span className="inline-flex min-w-0 items-center gap-1 truncate font-medium">
                {peer.display_name}
                {peer.is_founder && <FounderBadge size={9} />}
              </span>
            </Link>
          )}
          {peer && peer !== "not-found" && (
            <button
              type="button"
              onClick={handleDeleteChat}
              onBlur={() => setConfirmingDeleteChat(false)}
              className={`shrink-0 rounded-full p-2 ${
                confirmingDeleteChat
                  ? "bg-red-500/10 text-xs font-semibold text-red-600"
                  : "text-[var(--fg-muted)] hover:bg-red-500/10 hover:text-red-600"
              }`}
              title={dict.messages.deleteChat}
            >
              {confirmingDeleteChat ? dict.messages.deleteChat + "?" : <Icon name="trash" size={17} />}
            </button>
          )}
        </header>

        {peer === "not-found" && (
          <div className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">{dict.messages.notFound}</div>
        )}

        {peer && peer !== "not-found" && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              {items === null ? (
                <LoadingState label={dict.common.loading} />
              ) : (
                <div className="flex flex-col gap-3">
                  {nextCursor && (
                    <div className="pb-2 text-center">
                      <button type="button" onClick={loadOlder} className="btn-secondary-sm" disabled={loadingMore}>
                        {loadingMore ? dict.feed.loadingMore : dict.messages.loadMore}
                      </button>
                    </div>
                  )}

                  {items.length === 0 && (
                    <div className="px-6 py-16 text-center text-sm text-[var(--fg-muted)]">
                      {dict.messages.emptyThread}
                    </div>
                  )}

                  {viewer &&
                    items.map((m) => (
                      <DirectMessageBubble
                        key={m.id}
                        message={m}
                        mine={m.sender_id === viewer.id}
                        viewerId={viewer.id}
                        viewerName={viewer.display_name}
                        peerName={peer.display_name}
                        dict={dict}
                        menuOpen={actionMenuFor === m.id}
                        onOpenMenu={() => setActionMenuFor(m.id)}
                        onReact={(emoji) => toggleReaction(m, emoji)}
                        onReply={() => {
                          setActionMenuFor(null);
                          setEditingId(null);
                          setReplyTo(m);
                        }}
                        onForward={() => {
                          setActionMenuFor(null);
                          setForwardMessage(m);
                        }}
                        onEdit={() => startEdit(m)}
                        onDelete={() => handleDeleteMessage(m)}
                        editing={editingId === m.id}
                        editText={editText}
                        onEditTextChange={setEditText}
                        onSaveEdit={saveEdit}
                        onCancelEdit={() => setEditingId(null)}
                      />
                    ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
              {blocked ? (
                <p className="w-full py-3 text-center text-sm text-[var(--fg-muted)]">{dict.messages.blockedNotice}</p>
              ) : (
                <form onSubmit={handleSend} className="flex flex-col gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  {replyTo && (
                    <div className="flex items-center justify-between rounded-lg bg-[var(--bg-elevated)] px-3 py-1.5 text-xs">
                      <p className="min-w-0 truncate text-[var(--fg-muted)]">
                        {dict.messages.reply}:{" "}
                        {replyTo.text ?? `${replyTo.attachment_type === "video" ? "🎬" : "📷"} ${
                          replyTo.attachment_type === "video" ? dict.messages.video : dict.messages.photo
                        }`}
                      </p>
                      <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 pl-2">
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  )}

                  {attachment && (
                    <div className="relative inline-block w-fit">
                      {attachment.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachment.previewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                      ) : (
                        <video src={attachment.previewUrl} className="h-20 w-20 rounded-lg object-cover" />
                      )}
                      {sending ? (
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                          <Spinner size={20} className="text-white" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={clearAttachment}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                          aria-label={dict.messages.removeAttachment}
                        >
                          <Icon name="x" size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={sending}
                      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                      title={dict.messages.addAttachment}
                    >
                      <Icon name="paperclip" size={19} />
                    </button>
                    <textarea
                      className="input min-h-[42px] flex-1 resize-none"
                      placeholder={dict.messages.placeholder}
                      value={text}
                      maxLength={2000}
                      rows={1}
                      disabled={sending}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e);
                        }
                      }}
                    />
                    <button
                      type="submit"
                      className="btn-primary flex h-[42px] w-[42px] shrink-0 items-center justify-center p-0"
                      disabled={sending || (!text.trim() && !attachment)}
                      aria-label={dict.messages.send}
                    >
                      {sending ? <Spinner size={18} className="text-white" /> : <Icon name="send" size={18} />}
                    </button>
                  </div>
                </form>
              )}
              {error && <p className="field-error px-3 pb-2">{error}</p>}
            </div>
          </>
        )}
      </div>

      {forwardMessage && (
        <ForwardModal
          message={{
            text: forwardMessage.text,
            attachment_url: forwardMessage.attachment_url,
            attachment_type: forwardMessage.attachment_type,
            forwardOriginId: forwardMessage.forwarded_from?.id ?? forwardMessage.sender_id,
          }}
          onClose={() => setForwardMessage(null)}
        />
      )}
    </AppShell>
  );
}
