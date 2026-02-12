import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#121418",
          borderRadius: 96,
          border: "16px solid rgba(245, 122, 18, 0.35)",
        }}
      >
        <span
          style={{
            fontSize: 280,
            fontWeight: 900,
            fontStyle: "italic",
            color: "#F57A12",
            letterSpacing: -10,
            lineHeight: 1,
            marginTop: 16,
          }}
        >
          CV
        </span>
      </div>
    ),
    { ...size }
  );
}
