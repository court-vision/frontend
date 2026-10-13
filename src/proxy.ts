import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isDeskDemo, isDeskPath, WEEK_DESK, withFlagValues } from "@/components/desk/routes";
import { hasSessionHint, isRouterRequest } from "@/lib/session-hint";

// Desks that need an account. Week shows its own sign-in prompt (and a demo),
// Scout and Developer are public.
const isProtectedRoute = createRouteMatcher(["/draft(.*)", "/account(.*)"]);

// Where Clerk's middleware runs: the routes whose server side reads the session
// (the two desks above and Clerk's own forms), plus Clerk's Frontend API proxy
// path and API routes. Everywhere else the session lives in the browser alone:
// Week, Scout and Developer resolve it with clerk-js, and the landing, /privacy
// and the 404 have none. Running Clerk on every page cost a returning
// signed-in user's hard load a handshake whenever the session token was over
// 60 s old (www -> clerk.courtvision.dev/v1/client/handshake -> www, 300-550 ms
// before any HTML, measured 2026-10-13), only to refresh a cookie nothing on
// the server read. A server component outside these routes can't call auth():
// Clerk throws, since its middleware never ran.
const usesClerk = createRouteMatcher([
  "/draft(.*)",
  "/account(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/__clerk(.*)",
  "/(api|trpc)(.*)",
]);

// Public pages search engines may index.
const isIndexableRoute = createRouteMatcher(["/", "/scout(.*)", "/developer(.*)", "/sign-up(.*)", "/privacy"]);

/** What the proxy does to every page, with Clerk or without. */
function pageResponse(req: NextRequest): NextResponse | undefined {
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
}

const withClerk = clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication. A desk's demo runs on sample
  // data in the browser, so its own URLs (and only those) open signed out.
  if (isProtectedRoute(req) && !isDeskDemo(req.nextUrl.pathname, req.nextUrl.searchParams)) {
    // Week, Scout and Developer load without Clerk refreshing the session
    // token, so the router's prefetch of the bar's Draft and Account links can
    // leave before clerk-js has refreshed it. Protected, that prefetch came
    // back as a redirect to sign-in, which the router keeps for the route:
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
  return pageResponse(req);
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (usesClerk(req)) return withClerk(req, event);

  // The front door: the landing page signed out, your Week desk signed in. The
  // landing prerenders, so the call is made here, on Clerk's session cookie
  // rather than its middleware: a verified answer would cost the same
  // handshake. A stale hint (a session that ended while no Clerk page was open)
  // shows Week's own sign-in prompt once, and clearing it is that page's first
  // Clerk call.
  if (req.nextUrl.pathname === "/" && hasSessionHint(req.cookies.getAll())) {
    return NextResponse.redirect(new URL(WEEK_DESK, req.url));
  }
  return pageResponse(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
