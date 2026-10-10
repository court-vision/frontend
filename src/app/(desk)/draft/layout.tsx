import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft",
  description: "Draft-day board, calls and pick tracking for your league.",
  robots: { index: false, follow: false },
};

export default function DraftLayout({ children }: { children: React.ReactNode }) {
  return children;
}
