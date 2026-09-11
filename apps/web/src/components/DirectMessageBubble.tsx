"use client";

import { useState } from "react";

import { Icon } from "@/components/icons";
import type { DirectMessage } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/locales/ru";
import { formatRelativeTime } from "@/lib/time";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];

export function DirectMessageBubble({
  message,
  mine,
  viewerId,
  peerName,
  viewerName,
  locale,
  dict,
  reactionMenuOpen,
  onToggleReactionMenu,
  onReact,
  onReply,
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
  locale: Locale;
  dict: Dictionary;
  reactionMenuOpen: boolean;
  onToggleReactionMenu: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div
        className={`group relative max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
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
            {formatRelativeTime(message.created_at, locale)}
          </p>
        )}
      </div>

      {!editing && (
        <div className="mt-0.5 flex items-center gap-2.5 px-1 text-[var(--fg-muted)]">
          <button type="button" onClick={onToggleReactionMenu} title={dict.messages.react} className="hover:text-accent-600">
            <Icon name="smile" size={14} />
          </button>
          <button type="button" onClick={onReply} title={dict.messages.reply} className="hover:text-accent-600">
            <Icon name="reply" size={14} />
          </button>
          {mine && (
            <>
              <button type="button" onClick={onEdit} title={dict.messages.edit} className="hover:text-accent-600">
                <Icon name="pencil" size={14} />
              </button>
              <button
                type="button"
                onClick={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
                onBlur={() => setConfirmingDelete(false)}
                title={dict.messages.delete}
                className={confirmingDelete ? "text-xs font-semibold text-red-600" : "hover:text-red-600"}
              >
                {confirmingDelete ? dict.messages.deleteMessageConfirm : <Icon name="trash" size={14} />}
              </button>
            </>
          )}
        </div>
      )}

      {reactionMenuOpen && (
        <div className="mt-1 flex flex-wrap gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 shadow-md">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="rounded-full px-1 text-base hover:bg-black/5 dark:hover:bg-white/10"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {message.reactions.length > 0 && (
        <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onReact(r.emoji)}
              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
                r.reacted_by_viewer
                  ? "border-accent-500 bg-accent-500/10 text-accent-600 dark:text-accent-400"
                  : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)]"
              }`}
            >
              <span>{r.emoji}</span>
              <span>{r.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
