import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft Lab",
  description: "Draft-day board, recommendations and pick tracking for your league.",
};

export default function DraftLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
