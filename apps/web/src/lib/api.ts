// Относительный путь по умолчанию: браузер всегда идёт на тот же хост, с которого
// открыт сайт, а Next.js (см. next.config.mjs) проксирует /api/* на бэкенд.
// Так же работает и локально, и через LAN/туннель, и на проде — без правки под каждый адрес.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Файлы (фото/видео) заливаются намного дольше JSON-запросов, особенно на
// мобильном интернете через туннель — без таймаута зависший запрос выглядит
// так, будто кнопка отправки вообще ничего не делает.
const JSON_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 90_000;

async function request<T>(path: string, options: RequestInit = {}, jsonBody = true): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), jsonBody ? JSON_TIMEOUT_MS : UPLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: jsonBody
        ? { "Content-Type": "application/json", ...options.headers }
        : options.headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Превышено время ожидания ответа сервера. Проверьте соединение и попробуйте ещё раз.", 0);
    }
    throw new ApiError("Нет соединения с сервером", 0);
  } finally {
    clearTimeout(timeout);
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = body?.detail ?? "Request failed";
    throw new ApiError(typeof message === "string" ? message : "Request failed", response.status);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }, false),
  patchForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "PATCH", body: formData }, false),
};

export type UserMe = {
  id: string;
  display_name: string;
  username: string;
  email: string;
  email_verified: boolean;
  role: string;
  totp_enabled: boolean;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  city: string | null;
  website: string | null;
  is_founder: boolean;
  created_at: string;
  last_seen_at: string;
};

export type LoginResult = {
  requires_2fa: boolean;
  challenge_token: string | null;
  user: UserMe | null;
};

export type PostAuthor = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  is_founder: boolean;
};

export type PostImage = {
  id: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  alt_text: string | null;
};

export type Post = {
  id: string;
  author: PostAuthor;
  text: string | null;
  topic_id: string;
  city: string | null;
  images: PostImage[];
  video_url: string | null;
  parent_post_id: string | null;
  reply_to: PostAuthor | null;
  created_at: string;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  liked_by_viewer: boolean;
  reposted_by_viewer: boolean;
  bookmarked_by_viewer: boolean;
  reposted_by: PostAuthor | null;
  reposted_at: string | null;
};

export type FollowListPage = {
  items: PostAuthor[];
  next_cursor: string | null;
};

export type FeedPage = {
  items: Post[];
  next_cursor: string | null;
};

export type Topic = {
  id: string;
  slug: string;
  name_ru: string;
  name_uz: string;
  name_en: string;
};

export type SearchUser = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_founder: boolean;
};

export type SearchResponse = {
  users: SearchUser[];
  posts: Post[];
  posts_next_cursor: string | null;
};

export type NotificationItem = {
  id: string;
  type: "follow" | "like" | "reply" | "repost" | "mention";
  actor: PostAuthor;
  post_id: string | null;
  post_preview: string | null;
  actor_count: number;
  created_at: string;
  read_at: string | null;
};

export type NotificationPage = {
  items: NotificationItem[];
  next_cursor: string | null;
};

export type MessageReaction = {
  emoji: string;
  count: number;
  reacted_by_viewer: boolean;
};

export type ReplyPreview = {
  id: string;
  sender_id: string;
  text: string | null;
  attachment_type: "image" | "video" | null;
  is_deleted: boolean;
};

export type DirectMessage = {
  id: string;
  sender_id: string;
  text: string | null;
  attachment_url: string | null;
  attachment_thumbnail_url: string | null;
  attachment_type: "image" | "video" | null;
  reply_to: ReplyPreview | null;
  forwarded_from: PostAuthor | null;
  reactions: MessageReaction[];
  created_at: string;
  read_at: string | null;
  edited_at: string | null;
  is_deleted: boolean;
};

export type DirectMessagePage = {
  items: DirectMessage[];
  next_cursor: string | null;
};

export type Conversation = {
  peer: PostAuthor;
  last_message_text: string | null;
  last_message_attachment_type: "image" | "video" | null;
  last_message_at: string;
  last_message_is_mine: boolean;
  unread_count: number;
};

export type ConversationPage = {
  items: Conversation[];
  next_cursor: string | null;
};

export type GroupMember = PostAuthor & { role: "owner" | "member" };

export type GroupSummary = {
  id: string;
  title: string;
  avatar_url: string | null;
  member_count: number;
  last_message_text: string | null;
  last_message_attachment_type: "image" | "video" | null;
  last_message_at: string;
  last_message_sender_name: string | null;
  unread_count: number;
};

export type GroupListPage = {
  items: GroupSummary[];
  next_cursor: string | null;
};

export type Group = {
  id: string;
  title: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  is_owner: boolean;
  created_at: string;
  members: GroupMember[];
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender: PostAuthor;
  text: string | null;
  attachment_url: string | null;
  attachment_thumbnail_url: string | null;
  attachment_type: "image" | "video" | null;
  forwarded_from: PostAuthor | null;
  reactions: MessageReaction[];
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
};

export type GroupMessagePage = {
  items: GroupMessage[];
  next_cursor: string | null;
};

export type Profile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  city: string | null;
  website: string | null;
  is_founder: boolean;
  created_at: string;
  last_seen_at: string;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_self: boolean;
  is_blocked_by_viewer: boolean;
};
