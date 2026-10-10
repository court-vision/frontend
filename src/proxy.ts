import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isDeskDemo, isDeskPath, withFlagValues } from "@/components/desk/routes";

// Desks that need an account. Week shows its own sign-in prompt (and a demo),
// Scout and Developer are public.
const isProtectedRoute = createRouteMatcher(["/draft(.*)", "/account(.*)"]);

// Public pages search engines may index.
const isIndexableRoute = createRouteMatcher(["/", "/scout(.*)", "/developer(.*)", "/sign-up(.*)", "/privacy"]);

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication. A desk's demo runs on sample
  // data in the browser, so its own URLs (and only those) open signed out.
  if (isProtectedRoute(req) && !isDeskDemo(req.nextUrl.pathname, req.nextUrl.searchParams)) {
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
