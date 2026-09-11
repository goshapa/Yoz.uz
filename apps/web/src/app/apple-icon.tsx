import { ImageResponse } from "next/og";

import { manropeBold } from "@/lib/ogFont";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS не читает манифест — иконку для "На экран Домой" ищет по apple-touch-icon,
// без скруглений и прозрачности: угол и тень накладывает сама система.
export default async function AppleIcon() {
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
        <span style={{ color: "#ffffff", fontSize: 104, fontFamily: "Manrope" }}>Y</span>
      </div>
    ),
    { ...size, fonts: [{ name: "Manrope", data: fontData, weight: 800, style: "normal" }] },
  );
}
