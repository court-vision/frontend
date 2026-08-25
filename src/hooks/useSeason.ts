import { useMemo } from "react";
import { useScheduleWeeksQuery } from "@/hooks/useLineups";
import { resolveSeason, type ResolvedSeason } from "@/lib/season";

/**
 * The active season as the server sees it (`GET /schedule/weeks` → `season`),
 * resolved to a phase and labels. Returns the fallback season while the query
 * is loading (or when the API predates the `season` block), so SSR and static
 * output are unchanged.
 */
export function useSeason(): ResolvedSeason {
  const { data } = useScheduleWeeksQuery();
  const info = data?.season;
  return useMemo(() => resolveSeason(info), [info]);
}
