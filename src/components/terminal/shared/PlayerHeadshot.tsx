"use client";

import { useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * NBA headshots are keyed by the nba_api player ID, which is exactly
 * `nba.players.id` — so the URL is derivable and needs no storage.
 *
 * Note: the CDN answers an unknown ID with 200 + a generic silhouette,
 * not a 404. `onError` therefore fires only on a genuine network/decode
 * failure; a player without a portrait renders NBA's silhouette instead.
 */
const HEADSHOT_BASE = "https://cdn.nba.com/headshots/nba/latest";

export type HeadshotSize = "xs" | "sm" | "md" | "lg" | "xl";

// Real headshots are 260x190 with a transparent background, so they sit
// directly on the container fill. Cover crops width only (the source is
// wider than tall), leaving the head-and-shoulders framing intact.
const SIZE_STYLES: Record<HeadshotSize, { box: string; icon: string; px: number }> = {
  xs: { box: "h-6 w-6", icon: "h-3 w-3", px: 24 },
  sm: { box: "h-8 w-8", icon: "h-4 w-4", px: 32 },
  md: { box: "h-12 w-12", icon: "h-6 w-6", px: 48 },
  lg: { box: "h-16 w-16", icon: "h-8 w-8", px: 64 },
  xl: { box: "h-20 w-20", icon: "h-10 w-10", px: 80 },
};

// 260x190 crops to a 190px square, which still covers a 64px box on a 2x
// display. Only `xl` (80px, i.e. 240px at 3x) needs the 1040x760 original.
function headshotUrl(playerId: number, size: HeadshotSize): string {
  const variant = size === "xl" ? "1040x760" : "260x190";
  return `${HEADSHOT_BASE}/${variant}/${playerId}.png`;
}

interface PlayerHeadshotProps {
  /** NBA player ID (`nba.players.id`) — not an ESPN ID. */
  playerId?: number | null;
  /** Player name, used for the alt text. */
  name?: string;
  size?: HeadshotSize;
  className?: string;
}

export function PlayerHeadshot({
  playerId,
  name,
  size = "sm",
  className,
}: PlayerHeadshotProps) {
  // Keyed by id rather than a bare boolean so a failed load doesn't
  // suppress the headshot of whichever player is focused next.
  const [erroredId, setErroredId] = useState<number | null>(null);

  const styles = SIZE_STYLES[size];
  const showImage = playerId != null && erroredId !== playerId;

  return (
    <div
      className={cn(
        "rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden",
        styles.box,
        className
      )}
    >
      {showImage ? (
        // The CDN serves pre-sized ~17KB PNGs, so routing them through
        // next/image adds a per-image transform cost for no real byte saving.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={headshotUrl(playerId, size)}
          alt={name ? `${name} headshot` : "Player headshot"}
          width={styles.px}
          height={styles.px}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setErroredId(playerId)}
        />
      ) : (
        <User className={cn("text-muted-foreground", styles.icon)} />
      )}
    </div>
  );
}
