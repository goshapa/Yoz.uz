/** @type {import('next').NextConfig} */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
const MINIO_INTERNAL_URL = process.env.MINIO_INTERNAL_URL ?? "http://localhost:9000";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Убирает бейдж "Static route" в углу экрана — это индикатор Next.js только
  // для dev-режима (в проде его и так нет), но он путает при обычном тестировании.
  devIndicators: {
    appIsrStatus: false,
  },
  async headers() {
    // Базовые security-заголовки на уровне Next.js — работают уже сейчас, даже
    // без Caddy/HTTPS. Strict-Transport-Security сюда не добавляем: до домена и
    // TLS его отдавать нельзя (закрепит HTTPS-only для IP, которого не будет),
    // когда появится Caddy — HSTS добавляется в Caddyfile.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    // Проксируем /api/* и /yoz-media/* на бэкенд и MinIO с сервера Next.js, чтобы
    // браузер всегда обращался к тому же хосту, с которого открыт сайт (localhost,
    // LAN IP, туннель или прод-домен) — единственный надёжный способ не ловить
    // проблемы с cookie и CORS между разными доменами/портами. В проде (за Caddy,
    // см. Caddyfile) эти пути перехватываются раньше и до Next.js не доходят.
    return [
      {
        source: "/api/:path*",
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
      {
        source: "/yoz-media/:path*",
        destination: `${MINIO_INTERNAL_URL}/yoz-media/:path*`,
      },
    ];
  },
};

export default nextConfig;
