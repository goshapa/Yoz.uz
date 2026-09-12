"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { api, ApiError, type Post, type PostAuthor, type Topic } from "@/lib/api";
import { topicName, useI18n } from "@/lib/i18n";

const MAX_TEXT_LENGTH = 5000;
const MAX_IMAGES = 4;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const COMPOSER_EMOJIS = [
  "😀", "😂", "🥰", "😍", "😎", "🤔", "😢", "😭", "😡", "🥳",
  "👍", "👎", "👏", "🙏", "💪", "🔥", "✨", "💯", "🎉", "❤️",
  "💔", "😊", "😉", "😴", "🤗", "😱", "🙈", "😏", "👀", "💀",
  "🤝", "👌", "✌️", "🤞", "🫶", "🥺", "😅", "🤩", "😇", "🚀",
];

type ImageDraft = {
  file: File;
  previewUrl: string;
  altText: string;
};

type VideoDraft = {
  file: File;
  previewUrl: string;
};

export function PostComposer({
  parentPostId,
  replyTo,
  onSubmitted,
  onCancel,
}: {
  parentPostId?: string;
  replyTo?: PostAuthor | null;
  onSubmitted: (post: Post) => void;
  onCancel?: () => void;
}) {
  const { dict, locale } = useI18n();
  const isReply = Boolean(parentPostId);

  const [text, setText] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicId, setTopicId] = useState("");
  const [city, setCity] = useState("");
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [video, setVideo] = useState<VideoDraft | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isReply) return;
    api
      .get<Topic[]>("/topics")
      .then(setTopics)
      .catch(() => setTopics([]));
  }, [isReply]);

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      if (video) URL.revokeObjectURL(video.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => (t + emoji).slice(0, MAX_TEXT_LENGTH));
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + emoji + text.slice(end)).slice(0, MAX_TEXT_LENGTH);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(start + emoji.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    if (video) {
      URL.revokeObjectURL(video.previewUrl);
      setVideo(null);
    }
    const next = [...images];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_IMAGES) break;
      next.push({ file, previewUrl: URL.createObjectURL(file), altText: "" });
    }
    if (files.length + images.length > MAX_IMAGES) {
      setError(dict.composer.tooManyImages);
    }
    setImages(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  function setAltText(index: number, value: string) {
    setImages((current) => current.map((img, i) => (i === index ? { ...img, altText: value } : img)));
  }

  function handleVideoFile(file: File | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError(dict.composer.videoUnsupported);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(dict.composer.videoTooBig);
      return;
    }
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    if (video) URL.revokeObjectURL(video.previewUrl);
    setVideo({ file, previewUrl: URL.createObjectURL(file) });
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function removeVideo() {
    if (video) URL.revokeObjectURL(video.previewUrl);
    setVideo(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = text.trim();
    if (!trimmed && images.length === 0 && !video) {
      setError(dict.composer.emptyError);
      return;
    }
    const formData = new FormData();
    if (trimmed) formData.append("text", trimmed);
    if (isReply && parentPostId) {
      formData.append("parent_post_id", parentPostId);
      if (replyTo) formData.append("reply_to_user_id", replyTo.id);
    } else {
      if (topicId) formData.append("topic_id", topicId);
      if (city.trim()) formData.append("city", city.trim());
    }
    for (const img of images) {
      formData.append("images", img.file);
      formData.append("alt_texts", img.altText);
    }
    if (video) formData.append("video", video.file);

    setSubmitting(true);
    try {
      const post = await api.postForm<Post>("/posts", formData);
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      if (video) URL.revokeObjectURL(video.previewUrl);
      setText("");
      setImages([]);
      setVideo(null);
      setCity("");
      onSubmitted(post);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : dict.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const remaining = MAX_TEXT_LENGTH - text.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isReply && replyTo && (
        <p className="text-xs text-[var(--fg-muted)]">
          {dict.composer.replyingTo} <span className="text-accent-600 dark:text-accent-400">@{replyTo.username}</span>
        </p>
      )}

      <textarea
        ref={textareaRef}
        className="input min-h-[100px] resize-y"
        placeholder={isReply ? dict.composer.replyPlaceholder : dict.composer.placeholder}
        maxLength={MAX_TEXT_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setEmojiOpen(false)}
        autoFocus
      />
      <p className="text-right text-xs text-[var(--fg-muted)]">
        {remaining} {dict.composer.charsLeft}
      </p>

      {!isReply && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="label" htmlFor="composer-topic">
              {dict.composer.topicLabel}
            </label>
            <select
              id="composer-topic"
              className="input"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
            >
              <option value="">{dict.composer.topicPlaceholder}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topicName(topic, locale)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label" htmlFor="composer-city">
              {dict.composer.cityLabel}
            </label>
            <input
              id="composer-city"
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, index) => (
            <div key={img.previewUrl} className="space-y-1">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  aria-label="remove"
                >
                  ×
                </button>
              </div>
              <input
                className="input text-base sm:text-xs"
                placeholder={dict.composer.altTextPlaceholder}
                value={img.altText}
                maxLength={300}
                onChange={(e) => setAltText(index, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {video && (
        <div className="relative">
          <video src={video.previewUrl} controls className="max-h-64 w-full rounded-lg bg-black" />
          <button
            type="button"
            onClick={removeVideo}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            aria-label={dict.composer.removeVideo}
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex flex-wrap items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            id="composer-file-input"
            disabled={Boolean(video)}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <label
            htmlFor="composer-file-input"
            className={`btn-secondary-sm cursor-pointer ${video ? "pointer-events-none opacity-50" : ""}`}
          >
            {dict.composer.addImage} ({images.length}/{MAX_IMAGES})
          </label>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            id="composer-video-input"
            disabled={images.length > 0}
            onChange={(e) => handleVideoFile(e.target.files?.[0] ?? null)}
          />
          <label
            htmlFor="composer-video-input"
            className={`btn-secondary-sm cursor-pointer ${images.length > 0 ? "pointer-events-none opacity-50" : ""}`}
            title={dict.composer.addVideo}
          >
            <Icon name="play" size={14} />
          </label>

          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            className="btn-secondary-sm"
            title={dict.composer.addEmoji}
            aria-label={dict.composer.addEmoji}
          >
            <Icon name="smile" size={16} />
          </button>

          {emojiOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 grid w-64 grid-cols-8 gap-0.5 rounded-lg border-[1.5px] border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-lg">
              {COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="rounded-md py-1 text-lg hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              ×
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={submitting || remaining < 0}>
            {submitting ? dict.common.loading : isReply ? dict.composer.submitReply : dict.composer.submit}
          </button>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}
    </form>
  );
}
