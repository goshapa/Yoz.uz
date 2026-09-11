import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yoz — Fikringni yoz",
    short_name: "Yoz",
    description: "Yoz — соцсеть коротких публикаций для Узбекистана",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f6f5",
    theme_color: "#0f867e",
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
