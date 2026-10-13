import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDeskDemo, isDeskPath, withFlagValues } from "@/components/desk/routes";
import { hasSessionHint, isRouterRequest } from "@/lib/session-hint";

// Desks that need an account. Week shows its own sign-in prompt (and a demo),
// Scout and Developer are public.
const isProtectedRoute = createRouteMatcher(["/draft(.*)", "/account(.*)"]);

// Public pages search engines may index.
const isIndexableRoute = createRouteMatcher(["/", "/scout(.*)", "/developer(.*)", "/sign-up(.*)", "/privacy"]);

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication. A desk's demo runs on sample
  // data in the browser, so its own URLs (and only those) open signed out.
  if (isProtectedRoute(req) && !isDeskDemo(req.nextUrl.pathname, req.nextUrl.searchParams)) {
    // The router's prefetch of a desk bar's Draft or Account link can leave
    // with a session token that expired while the tab sat in the background,
    // before clerk-js has refreshed it. Protected, that prefetch came back as
    // a redirect to sign-in, which the router keeps for the route:
    // following the link then landed on sign-in with no request at all
    // (measured on a local build). Only a document load can refresh the token
    // here (Clerk's handshake), so when the browser holds a session but the
    // token didn't verify, answer the router with 204: a prefetch takes it as
    // a miss and caches nothing, and a navigation falls back to loading the
    // page in full, which Clerk then handles as it always has.
    if (isRouterRequest(req) && hasSessionHint(req.cookies.getAll()) && !(await auth()).userId) {
      return new NextResponse(null, { status: 204 });
    }
    await auth.protect();
  }

  // On Vercel a bare flag (`/week?demo`) never reaches the page, so give it a
  // value there; the address bar keeps the URL as it was.
  const flagged = isDeskPath(req.nextUrl.pathname) ? withFlagValues(req.nextUrl.searchParams) : null;
  let response: NextResponse | undefined;
  if (flagged) {
    const url = req.nextUrl.clone();
    url.search = flagged.toString();
    response = NextResponse.rewrite(url);
  }

  // Clerk's middleware adds X-Robots-Tag: noindex to all routes it processes.
  // Remove it for public pages so Google can index them.
  if (isIndexableRoute(req)) {
    response ??= NextResponse.next();
    response.headers.delete("X-Robots-Tag");
  }
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
