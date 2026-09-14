"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const MobileDockContext = createContext<HTMLElement | null>(null);

/** Set by `Base` to the dock element between the scroll area and the tab bar. */
export const MobileDockProvider = MobileDockContext.Provider;

/**
 * Render `children` in the phone dock: an in-flow strip between the page's
 * scroll area and the tab bar. Outside the scroller, a docked bar sits flush
 * on the tab bar and never covers the end of the page (a `sticky` bar inside
 * `<main>` stops short by the page padding). Renders nothing until the dock
 * has mounted.
 */
export function MobileDockPortal({ children }: { children: ReactNode }) {
  const dock = useContext(MobileDockContext);
  return dock ? createPortal(children, dock) : null;
}
