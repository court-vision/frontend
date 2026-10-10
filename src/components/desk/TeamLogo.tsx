"use client";

import { useEffect, useRef, useState } from "react";
import { teamLogoUrl } from "@/lib/nbaTeams";
import { useDeskScheme } from "./useDeskTheme";
import dk from "./desk.module.css";

/**
 * An NBA team's logo from cdn.nba.com, in the variant drawn for the desk's
 * ground (dark or light). An abbreviation the table does not know, or a
 * network failure, shows the abbreviation instead. Loaded eagerly: they are
 * small, few, and a lazy one never arrives while the page is hidden.
 */
export function TeamLogo({ abbrev, size = 20, className }: { abbrev: string | null | undefined; size?: number; className?: string }) {
  const scheme = useDeskScheme();
  const [failed, setFailed] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const key = abbrev ? `${abbrev.toUpperCase()}:${scheme}` : null;
  const url = abbrev ? teamLogoUrl(abbrev, scheme) : null;

  // An image that failed before hydration never fires React's onError.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0 && key) setFailed(key);
  }, [key]);

  if (!abbrev || !url || failed === key) {
    return (
      <span className={`${dk.logoMark} ${className ?? ""}`} style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.34)) }} aria-hidden>
        {abbrev ? abbrev.toUpperCase().slice(0, 3) : "—"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      key={key ?? undefined}
      className={`${dk.logo} ${className ?? ""}`}
      src={url}
      alt=""
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      onError={() => setFailed(key)}
      aria-hidden
    />
  );
}
