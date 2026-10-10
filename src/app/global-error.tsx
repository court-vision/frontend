"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Replaces the root layout when it throws, so it renders its own html/body and
// can't lean on the desk frame's tokens or fonts: Midnight's colours, inline.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 clamp(20px, 4vw, 56px)",
          background: "#0f1729",
          color: "#e8eef8",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, color: "#5cc8ff" }}>
          {error.digest ? `Error · ref ${error.digest}` : "Error"}
        </span>
        <h1 style={{ margin: "10px 0 0", fontSize: "clamp(2.5rem, 6vw, 5rem)", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 0.92 }}>
          Court Vision couldn&apos;t load.
        </h1>
        <p style={{ maxWidth: "46ch", marginTop: 18, fontSize: 17, lineHeight: 1.55, color: "#adbad2" }}>
          Something stopped the app from starting. Reloading usually fixes it.
        </p>
        <div style={{ marginTop: 28 }}>
          <button
            type="button"
            onClick={reset}
            style={{ height: 44, padding: "0 18px", border: 0, borderRadius: 8, background: "#5cc8ff", color: "#04121f", font: "inherit", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
