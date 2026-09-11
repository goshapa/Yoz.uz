"use client";

import { useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons";
import type { GroupMessage } from "@/lib/api";
import type { Dictionary } from "@/lib/i18n/locales/ru";
import { formatClockTime } from "@/lib/time";

const LONG_PRESS_MS = 450;
const MOVE_CANCEL_PX = 8;

export function GroupMessageBubble({
  message,
  mine,
  dict,
  menuOpen,
  onOpenMenu,
  onEdit,
  onDelete,
  editing,
  editText,
  onEditTextChange,
  onSaveEdit,
  onCancelEdit,
}: {
  message: GroupMessage;
  mine: boolean;
  dict: Dictionary;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!mine || editing) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      if (!movedRef.current) onOpenMenu();
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
      movedRef.current = true;
      clearLongPress();
    }
  }

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className={`flex max-w-[80%] items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
        {!mine && <Avatar src={message.sender.avatar_url} name={message.sender.display_name} size={28} />}

        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={clearLongPress}
          onPointerCancel={clearLongPress}
          onContextMenu={(e) => mine && e.preventDefault()}
          className={`relative min-w-0 select-none rounded-2xl px-3.5 py-2 text-sm ${
            mine ? "rounded-br-sm bg-accent-600 text-white" : "rounded-bl-sm bg-[var(--bg-elevated)] text-[var(--fg)]"
          }`}
        >
          {!mine && <p className="mb-0.5 text-xs font-semibold text-accent-600 dark:text-accent-400">{message.sender.display_name}</p>}

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
        </div>
      </div>

      {mine && menuOpen && !editing && (
        <div
          data-message-menu
          className="mt-2 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-lg"
        >
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Icon name="pencil" size={16} />
            {dict.messages.edit}
          </button>
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
        </div>
      )}
    </div>
  );
}
