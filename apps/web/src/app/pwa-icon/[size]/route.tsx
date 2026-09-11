import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

import { manropeBold } from "@/lib/ogFont";

// Иконка для манифеста PWA: рисуем через ImageResponse, без бинарных файлов в
// репозитории — размер и maskable-вариант (безопасная зона для адаптивных
// иконок Android) задаются параметрами запроса.
export async function GET(request: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = Math.min(1024, Math.max(16, parseInt(sizeParam, 10) || 512));
  const maskable = request.nextUrl.searchParams.get("maskable") === "1";
  const glyphSize = Math.round(size * (maskable ? 0.34 : 0.52));

  const fontData = await manropeBold();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f867e",
        }}
      >
        <span style={{ color: "#ffffff", fontSize: glyphSize, fontFamily: "Manrope" }}>Y</span>
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Manrope", data: fontData, weight: 800, style: "normal" }],
    },
  );
}
