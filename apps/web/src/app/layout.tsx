import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import { Providers } from "@/providers/Providers";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yoz",
  description: "Fikringni yoz — соцсеть коротких публикаций для Узбекистана",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yoz",
  },
  other: {
    // Next.js сам добавляет современный mobile-web-app-capable; старые версии
    // iOS Safari понимают только этот вендорный вариант — дублируем на всякий случай.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f867e",
  // Позволяет странице занять весь экран за скруглёнными углами/чёлкой/индикатором
  // Home в standalone-режиме на iOS — без этого env(safe-area-inset-*) всегда равен 0.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning className={manrope.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
