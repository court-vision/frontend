"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { ApiError } from "./api-error";
import type { GetTokenFn } from "./http";

/**
 * A desk demo's account: nobody. Inside `DemoAuth` the hooks that read the
 * session through `useDeskAuth` see a signed-out visitor, whoever is signed in,
 * so their queries stay off and answer from what the demo put in its own query
 * client, and every write stops before a request leaves with the demo's words
 * (an `AI_DEMO` error, which `aiMessage` shows as it is).
 */
export const DEMO_REFUSAL = "This is the demo: nothing is sent. Sign in to ask Dime yourself.";

export interface DeskAuth {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  userId: string | null | undefined;
  getToken: GetTokenFn;
}

const refuse: GetTokenFn = () =>
  Promise.reject(new ApiError({ message: DEMO_REFUSAL, status: 0, kind: "unknown", code: "AI_DEMO" }));

const DEMO_AUTH: DeskAuth = { isLoaded: true, isSignedIn: false, userId: null, getToken: refuse };

const DemoContext = createContext(false);

export function DemoAuth({ children }: { children: ReactNode }) {
  return <DemoContext.Provider value>{children}</DemoContext.Provider>;
}

/** Whether this is a demo's tree. */
export function useIsDemo(): boolean {
  return useContext(DemoContext);
}

/** Clerk's session, or nobody's inside a demo. */
export function useDeskAuth(): DeskAuth {
  const demo = useContext(DemoContext);
  const auth = useAuth();
  return demo ? DEMO_AUTH : auth;
}
