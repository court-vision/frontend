"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTerminalStore } from "@/stores/useTerminalStore";

/**
 * Returns a `focusPlayer(id)` function that sets the focused player in the
 * terminal store and navigates to /terminal if not already there.
 */
export function useFocusPlayer() {
  const { setFocusedPlayer } = useTerminalStore();
  const pathname = usePathname();
  const router = useRouter();

  return useCallback(
    (playerId: number) => {
      setFocusedPlayer(playerId);
      if (!pathname.startsWith("/terminal")) {
        router.push("/terminal");
      }
    },
    [setFocusedPlayer, pathname, router]
  );
}
