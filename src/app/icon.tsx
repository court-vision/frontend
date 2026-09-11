import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** The wordmark's own initials: bone "C", amber "V", on the app background. */
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
          background: "#221f1c",
          borderRadius: 112,
        }}
      >
        <span
          style={{
            display: "flex",
            fontSize: 300,
            fontWeight: 900,
            color: "#f1ede9",
            letterSpacing: -24,
            lineHeight: 1,
            marginTop: 12,
          }}
        >
          C<span style={{ color: "#f57d14" }}>V</span>
        </span>
      </div>
    ),
    { ...size }
  );
}
