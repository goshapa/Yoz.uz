import type { Metadata } from "next";
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
