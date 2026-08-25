"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelectedTeam } from "@/hooks/useSelectedTeam";
import {
  hasFormatParam,
  normalizeParams,
  parseRankingsSearchParams,
  rankableCategories,
  toSearchString,
} from "@/lib/rankings-params";
import type { RankingsParams } from "@/types/rankings";

export type RankingsParamsSource = "url" | "league" | "default";

function readSearch(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

/**
 * Rankings params resolved as URL > selected team's league > points.
 *
 * The URL is read after mount (not via useSearchParams) so the statically
 * prerendered points table stays in the HTML for crawlers and first paint.
 */
export function useRankingsParams() {
  const router = useRouter();
  const pathname = usePathname();
  const { league, isCategories } = useSelectedTeam();
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch(readSearch());
    const onPop = () => setSearch(readSearch());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const urlHasFormat = hasFormatParam(search);
  const leagueKeys = useMemo(
    () => rankableCategories(league?.categories.map((c) => c.key) ?? null),
    [league]
  );

  const params = useMemo<RankingsParams>(() => {
    const fromUrl = parseRankingsSearchParams(search);
    const leagueDefault: Partial<RankingsParams> =
      !urlHasFormat && isCategories ? { format: "categories", categories: leagueKeys } : {};
    return normalizeParams({ ...leagueDefault, ...fromUrl });
  }, [search, urlHasFormat, isCategories, leagueKeys]);

  const source: RankingsParamsSource = urlHasFormat ? "url" : isCategories ? "league" : "default";

  const setParams = useCallback(
    (patch: Partial<RankingsParams>) => {
      const next = normalizeParams({ ...params, ...patch });
      // Switching to categories without explicit keys adopts the league's list.
      if (patch.format === "categories" && patch.categories === undefined && !next.categories) {
        next.categories = leagueKeys;
      }
      const qs = toSearchString(next);
      // Always pin `format` once the user has chosen, so league defaults stop overriding.
      const pinned = qs ? `${qs}${qs.includes("format=") ? "" : "&format=points"}` : "format=points";
      const url = `${pathname}?${pinned}`;
      router.replace(url, { scroll: false });
      setSearch(`?${pinned}`);
    },
    [params, leagueKeys, pathname, router]
  );

  return { params, setParams, source, leagueName: league?.name ?? null, leagueKeys };
}
