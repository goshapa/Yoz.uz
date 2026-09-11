import { ImageResponse } from "next/og";

import { manropeBold } from "@/lib/ogFont";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
          borderRadius: 7,
          background: "#0f867e",
        }}
      >
        <span style={{ color: "#ffffff", fontSize: 20, fontFamily: "Manrope" }}>Y</span>
      </div>
    ),
    { ...size, fonts: [{ name: "Manrope", data: fontData, weight: 800, style: "normal" }] },
  );
}
