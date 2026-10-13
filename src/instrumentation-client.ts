// Runs before hydration on every route, so it must stay tiny: it only starts
// buffering errors. @sentry/nextjs itself loads once the page is idle, and
// with tracing off there is no router-transition hook to export
// (src/lib/report-error.ts).
import { installErrorReporting } from "@/lib/report-error";

installErrorReporting();
