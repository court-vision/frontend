import { ClerkProvider } from "@clerk/nextjs";
import { CommandPalette } from "@/components/desk/CommandPalette";
import { ACCOUNT_DESK, WEEK_DESK } from "@/components/desk/routes";

/**
 * Clerk, for the pages that use it: the desks, and the sign-in and sign-up
 * forms that lead into them (here too, so signing in and landing on a desk is
 * one Clerk provider, not one torn down and another started). The landing,
 * /privacy and the 404 sit outside this group and ship no Clerk at all: the
 * provider in the root layout put Clerk's SDK, clerk-js and its UI entry on
 * every one of them, which never used it (172 KB br of the landing's 448 KB
 * first-load JS on a local build, before clerk-js fetched the rest of its UI).
 * The root layout's DeskFrame still frames every page.
 */
export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInFallbackRedirectUrl={WEEK_DESK} signUpFallbackRedirectUrl={`${ACCOUNT_DESK}?add`} afterSignOutUrl="/">
      {children}
      {/* ⌘K on every desk and on the way in. It reads Clerk (your teams, sign out), so it sits here rather than in the frame. */}
      <CommandPalette />
    </ClerkProvider>
  );
}
