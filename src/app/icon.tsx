import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** The wordmark's own initials in Midnight, the default theme: an ink "C" and a sky "V" on navy. */
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
          background: "#0f1729",
          borderRadius: 112,
        }}
      >
        <span
          style={{
            display: "flex",
            fontSize: 300,
            fontWeight: 900,
            color: "#e8eef8",
            letterSpacing: -24,
            lineHeight: 1,
            marginTop: 12,
          }}
        >
          C<span style={{ color: "#5cc8ff" }}>V</span>
        </span>
      </div>
    ),
    { ...size }
  );
}
