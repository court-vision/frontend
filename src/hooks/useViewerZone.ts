import { useSyncExternalStore } from "react";
import { ET_ZONE, viewerZone } from "@/lib/local-time";

const subscribe = () => () => {};

/**
 * The viewer's time zone, for a component that prints clock times.
 *
 * The server renders the desks too (the demos have their times at once), and
 * it has no viewer, so it prints in `serverZone`. Through hydration this hook
 * answers the same, then React renders again with the browser's own zone. A
 * component that prints a time calls it and passes the zone to the formatters
 * in `@/lib/local-time`, which otherwise can't tell a hydrating render from a
 * later one.
 */
export function useViewerZone(serverZone: string = ET_ZONE): string {
  return useSyncExternalStore(subscribe, viewerZone, () => serverZone);
}
