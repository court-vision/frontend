import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT
// are set (Vercel); otherwise the wrapper is a no-op at build time.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Proxy browser events through the app so ad blockers don't drop them.
  tunnelRoute: "/monitoring",
  telemetry: false,
  // A source-map upload problem must never fail a Vercel deploy.
  errorHandler: (err) => {
    console.warn("[sentry] source-map upload skipped:", err.message);
  },
});
