"use client";

import { useEffect, useRef, useState } from "react";
import dk from "@/components/desk/desk.module.css";

/**
 * NBA's portrait, keyed by the nba_api id (`nba.players.id`). The CDN answers
 * an unknown id with its own silhouette, so a failure means the network; initials
 * stand in then, and when there is no id at all.
 */
export function Headshot({ nbaId, name, size = 30 }: { nbaId: number | null | undefined; name: string; size?: number }) {
  const [failed, setFailed] = useState<number | null>(null);
  const img = useRef<HTMLImageElement>(null);

  // An image that failed before hydration never fires React's onError.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0 && nbaId != null) setFailed(nbaId);
  }, [nbaId]);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <span className={dk.face} style={{ width: size, height: size }} data-face aria-hidden>
      {nbaId != null && failed !== nbaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={img}
          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(nbaId)}
        />
      ) : (
        <span className={dk.faceInitials}>{initials}</span>
      )}
    </span>
  );
}
