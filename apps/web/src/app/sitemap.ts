import type { MetadataRoute } from "next";

const SITE_URL = "https://yozapp.uz";
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

type FeedPost = { id: string; created_at: string; author: { username: string } };

async function fetchRecentPosts(): Promise<FeedPost[]> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/v1/feed/overview?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items: FeedPost[] };
    return data.items;
  } catch {
    // Бэкенд недоступен на момент генерации карты сайта — отдаём хотя бы
    // статические страницы, а не роняем /sitemap.xml целиком.
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/community-rules`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const posts = await fetchRecentPosts();

  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/post/${post.id}`,
    lastModified: post.created_at,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const usernames = Array.from(new Set(posts.map((post) => post.author.username)));
  const profilePages: MetadataRoute.Sitemap = usernames.map((username) => ({
    url: `${SITE_URL}/u/${username}`,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  return [...staticPages, ...postPages, ...profilePages];
}
