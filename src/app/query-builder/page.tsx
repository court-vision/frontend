"use client";

import { useAuth } from "@clerk/nextjs";
import { useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useUIStore } from "@/stores/useUIStore";

const SQLMATE_ORIGIN =
  process.env.NEXT_PUBLIC_SQLMATE_ORIGIN || "https://sqlmate.courtvision.dev";
const TOKEN_REFRESH_INTERVAL = 30_000;

const THEME_CSS_VARS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--input",
  "--ring",
] as const;

function getThemeVariables(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement);
  const vars: Record<string, string> = {};
  for (const v of THEME_CSS_VARS) {
    vars[v] = styles.getPropertyValue(v).trim();
  }
  return vars;
}

export default function QueryBuilderPage() {
  const { getToken } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const selectedProvider = useUIStore((s) => s.selectedProvider);

  const sendToken = useCallback(async () => {
    const token = await getToken();
    if (token && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "clerk-token", token },
        SQLMATE_ORIGIN
      );
    }
  }, [getToken]);

  const sendTheme = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;

    const mode = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const provider = useUIStore.getState().selectedProvider || "espn";

    iframeRef.current.contentWindow.postMessage(
      {
        type: "theme-sync",
        payload: { mode, provider, variables: getThemeVariables() },
      },
      SQLMATE_ORIGIN
    );
  }, []);

  const handleIframeLoad = useCallback(() => {
    sendToken();
    setTimeout(sendTheme, 100);
  }, [sendToken, sendTheme]);

  // Token refresh interval
  useEffect(() => {
    const interval = setInterval(sendToken, TOKEN_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [sendToken]);

  // Re-send theme when light/dark mode changes
  useEffect(() => {
    const timer = setTimeout(sendTheme, 50);
    return () => clearTimeout(timer);
  }, [resolvedTheme, sendTheme]);

  // Re-send theme when provider (ESPN/Yahoo) changes
  useEffect(() => {
    const timer = setTimeout(sendTheme, 50);
    return () => clearTimeout(timer);
  }, [selectedProvider, sendTheme]);

  // Listen for SQLMate ready handshake
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== SQLMATE_ORIGIN) return;
      if (event.data?.type === "sqlmate-ready") {
        sendToken();
        sendTheme();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendToken, sendTheme]);

  return (
    <iframe
      ref={iframeRef}
      src={`${SQLMATE_ORIGIN}?embedded=true`}
      onLoad={handleIframeLoad}
      className="w-full h-[calc(94vh-60px)] border-0"
      allow="clipboard-write"
    />
  );
}
