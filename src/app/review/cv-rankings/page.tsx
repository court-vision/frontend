import type { Metadata } from "next";

import ReviewClient, { type ReviewSnapshot } from "./ReviewClient";
import snapshot from "./snapshot.json";

// A review page, not a product page: public so it opens anywhere without a
// sign-in, but kept out of search (Clerk's proxy already sends noindex for
// every route it does not list as indexable; this says so in the HTML too).
export const metadata: Metadata = {
  title: "CV rankings review",
  description: "Court Vision's base rankings and draft projection adjustments, snapshot for review.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ReviewClient snapshot={snapshot as ReviewSnapshot} />;
}
