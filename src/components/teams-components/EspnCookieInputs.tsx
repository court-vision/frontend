"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ESPN_COOKIE_BOOKMARKLET, parseCookieString, type EspnCookies } from "@/lib/espn-cookies";

/** The one-time setup for copying espn_s2 and SWID out of a logged-in ESPN tab. */
export function EspnBookmarkletStep() {
  return (
    <div className="rounded-md border border-dashed p-3 bg-muted/30">
      <p className="text-sm text-muted-foreground mb-2">
        Step 1: Drag this button to your bookmarks bar:
      </p>
      <div
        dangerouslySetInnerHTML={{
          __html: `<a href="${ESPN_COOKIE_BOOKMARKLET}" class="inline-block px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md cursor-grab hover:bg-primary/90" onclick="event.preventDefault()">Get ESPN Cookies</a>`,
        }}
      />
      <p className="text-xs text-muted-foreground mt-2">
        Step 2: Log into ESPN, then click the bookmark and copy the result.
      </p>
    </div>
  );
}

/**
 * A paste box that pulls espn_s2 and SWID out of whatever is pasted.
 * `onParsed` gets both cookies, or null while the input holds no complete pair.
 */
export function EspnCookiePaste({ onParsed }: { onParsed: (cookies: EspnCookies | null) => void }) {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<EspnCookies | null>(null);

  return (
    <div className="space-y-2">
      <Label>Paste cookie string</Label>
      <Input
        placeholder="espn_s2=...; SWID=..."
        value={input}
        onChange={(e) => {
          const value = e.target.value;
          setInput(value);
          const cookies = value.trim() ? parseCookieString(value) : null;
          setParsed(cookies);
          onParsed(cookies);
        }}
      />
      {parsed && (
        <div className="text-sm text-status-win space-y-1">
          <p>Cookies parsed successfully:</p>
          <p className="font-mono text-xs truncate">espn_s2: {parsed.s2.slice(0, 20)}...</p>
          <p className="font-mono text-xs truncate">SWID: {parsed.swid}</p>
        </div>
      )}
    </div>
  );
}
