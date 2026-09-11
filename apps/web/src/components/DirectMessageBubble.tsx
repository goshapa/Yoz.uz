"use client";

import { useRef, useState } from "react";

import { Icon } from "@/components/icons";
import type { DirectMessage } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/locales/ru";
import { formatClockTime } from "@/lib/time";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];

const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 72;
const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 8;

export function DirectMessageBubble({
  message,
  mine,
  viewerId,
  peerName,
  viewerName,
  dict,
  menuOpen,
  onOpenMenu,
  onReact,
  onReply,
  onForward,
  onEdit,
  onDelete,
  editing,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
}: {
  message: DirectMessage;
  mine: boolean;
  viewerId: string;
  peerName: string;
  viewerName: string;
  dict: Dictionary;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onForward: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (message.is_deleted) {
    return (
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[75%] rounded-2xl bg-[var(--bg-elevated)] px-3.5 py-2 text-sm italic text-[var(--fg-muted)]">
          {dict.messages.deletedPlaceholder}
        </div>
      </div>
    );
  }

  function nameFor(senderId: string): string {
    return senderId === viewerId ? viewerName : peerName;
  }

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (editing) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      if (!movedRef.current) onOpenMenu();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (editing) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
      movedRef.current = true;
      clearLongPress();
    }
    if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
      setDragging(true);
      setDragX(Math.min(dx, SWIPE_MAX_PX));
    }
  }

  function handlePointerUp() {
    clearLongPress();
    if (dragX > SWIPE_TRIGGER_PX) onReply();
    setDragging(false);
    setDragX(0);
  }

  function handlePointerCancel() {
    clearLongPress();
    setDragging(false);
    setDragX(0);
  }

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`flex items-center ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden text-accent-600"
          style={{
            width: Math.min(dragX, 32),
            opacity: Math.min(dragX / 28, 1),
            transition: dragging ? "none" : "width 0.15s ease, opacity 0.15s ease",
          }}
        >
          <Icon name="reply" size={16} />
        </div>

        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            transform: dragX ? `translateX(${dragX}px)` : undefined,
            transition: dragging ? "none" : "transform 0.2s ease",
            touchAction: "pan-y",
          }}
          className={`relative max-w-[75%] select-none rounded-2xl px-3.5 py-2 text-sm ${
            mine ? "rounded-br-sm bg-accent-600 text-white" : "rounded-bl-sm bg-[var(--bg-elevated)] text-[var(--fg)]"
          }`}
        >
          {message.reply_to && (
            <div
              className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                mine ? "border-white/50 bg-white/10 text-white/80" : "border-accent-500/60 bg-black/5 text-[var(--fg-muted)]"
              }`}
            >
              <p className="mb-0.5 font-semibold">{nameFor(message.reply_to.sender_id)}</p>
              <p className="truncate">
                {message.reply_to.is_deleted
                  ? dict.messages.deletedPlaceholder
                  : message.reply_to.text ??
                    `${message.reply_to.attachment_type === "video" ? "🎬" : "📷"} ${
                      message.reply_to.attachment_type === "video" ? dict.messages.video : dict.messages.photo
                    }`}
              </p>
            </div>
          )}

          {editing ? (
            <div className="space-y-1.5">
              <textarea
                className="w-full min-w-[200px] resize-none rounded-lg border border-white/30 bg-black/10 px-2 py-1 text-sm text-inherit outline-none"
                value={editText}
                maxLength={2000}
                rows={2}
                autoFocus
                onChange={(e) => onEditTextChange(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancelEdit} className="text-xs underline opacity-80">
                  {dict.messages.editCancel}
                </button>
                <button type="button" onClick={onSaveEdit} className="text-xs font-semibold underline">
                  {dict.messages.editSave}
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.attachment_type === "image" && message.attachment_url && (
                <a href={message.attachment_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.attachment_thumbnail_url ?? message.attachment_url}
                    alt=""
                    className="mb-1 max-h-72 w-full rounded-lg object-cover"
                  />
                </a>
              )}
              {message.attachment_type === "video" && message.attachment_url && (
                <video src={message.attachment_url} controls className="mb-1 max-h-72 w-full rounded-lg" />
              )}
              {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
            </>
          )}

          {!editing && (
            <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-[var(--fg-muted)]"}`}>
              {message.edited_at && `${dict.messages.edited} · `}
              {formatClockTime(message.created_at)}
            </p>
          )}

          {message.reactions.length > 0 && (
            <div
              className={`absolute -bottom-3 flex items-center gap-1 rounded-full border-2 border-[var(--bg)] bg-[var(--bg-elevated)] px-1.5 py-0.5 shadow-sm ${
                mine ? "right-2" : "left-2"
              }`}
            >
              {message.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => onReact(r.emoji)}
                  className={`flex items-center gap-0.5 text-xs leading-none ${
                    r.reacted_by_viewer ? "text-accent-600 dark:text-accent-400" : "text-[var(--fg-muted)]"
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {menuOpen && !editing && (
        <div
          data-message-menu
          className={`mt-2 w-72 max-w-[90vw] rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-lg ${
            message.reactions.length > 0 ? "mt-4" : "mt-2"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className="rounded-full py-0.5 text-lg hover:bg-black/5 dark:hover:bg-white/10"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={onForward}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Icon name="forward" size={16} />
              {dict.messages.forward}
            </button>
            {mine && (
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Icon name="pencil" size={16} />
                {dict.messages.edit}
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
                onBlur={() => setConfirmingDelete(false)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-red-500/10 ${
                  confirmingDelete ? "font-semibold text-red-600" : "text-red-600"
                }`}
              >
                <Icon name="trash" size={16} />
                {confirmingDelete ? dict.messages.deleteMessageConfirm : dict.messages.delete}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
