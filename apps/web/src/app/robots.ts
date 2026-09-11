import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/settings",
        "/messages",
        "/notifications",
        "/bookmarks",
        "/verify-email",
        "/reset-password",
        "/forgot-password",
      ],
    },
    sitemap: "https://yozapp.uz/sitemap.xml",
  };
}
