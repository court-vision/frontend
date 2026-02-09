"use client";

import { useAuth } from "@clerk/nextjs";
import { useRef, useEffect, useCallback } from "react";

const SQLMATE_ORIGIN =
  process.env.NEXT_PUBLIC_SQLMATE_ORIGIN || "https://sqlmate.courtvision.dev";
const TOKEN_REFRESH_INTERVAL = 30_000;

export default function QueryBuilderPage() {
  const { getToken } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendToken = useCallback(async () => {
    const token = await getToken();
    if (token && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "clerk-token", token },
        SQLMATE_ORIGIN
      );
    }
  }, [getToken]);

  const handleIframeLoad = useCallback(() => {
    sendToken();
  }, [sendToken]);

  useEffect(() => {
    const interval = setInterval(sendToken, TOKEN_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [sendToken]);

  return (
    <iframe
      ref={iframeRef}
      src={`${SQLMATE_ORIGIN}?embedded=true`}
      onLoad={handleIframeLoad}
      className="w-full h-[calc(100vh-64px)] border-0"
      allow="clipboard-write"
    />
  );
}
