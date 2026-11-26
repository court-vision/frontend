"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { zoomArrived } from "@/lib/desk-zoom";

/** Tells a row that is opening into a desk (`zoomTo`) that the desk is on screen. Mounted once, in the desks' layout. */
export function ZoomArrival() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    zoomArrived();
  }, [pathname]);
  return null;
}
