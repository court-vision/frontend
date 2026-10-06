import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/your-teams(.*)",
  "/lineup-generation(.*)",
  "/manage-lineups(.*)",
  "/manage-teams(.*)",
  "/draft(.*)",
  "/matchup(.*)",
  "/streamers(.*)",
  "/query-builder/manage-tables(.*)",
]);

// Public routes that should be crawlable by search engines
const isIndexableRoute = createRouteMatcher([
  "/",
  "/rankings(.*)",
  "/playoffs(.*)",
  "/terminal(.*)",
]);

// A desk's demo runs on sample data in the browser: no account needed.
function isDeskDemo(req: { nextUrl: URL }): boolean {
  return req.nextUrl.searchParams.has("demo") || /^\/draft\/demo-\d+(\/|$)/.test(req.nextUrl.pathname);
}

export default clerkMiddleware(async (auth, req) => {
  // Protect routes that require authentication
  if (isProtectedRoute(req) && !isDeskDemo(req)) {
    await auth.protect();
  }

  // Clerk's middleware adds X-Robots-Tag: noindex to all routes it processes.
  // Remove it for public pages so Google can index them.
  if (isIndexableRoute(req)) {
    const response = NextResponse.next();
    response.headers.delete("X-Robots-Tag");
    return response;
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
