import type { Metadata } from "next";
import { ScoutPage } from "@/components/scout/ScoutPage";
import { focusFromSearch } from "@/lib/scout";

export const metadata: Metadata = {
  title: "Scout",
  description: "One player, team or night at a time: every public number Court Vision keeps.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const k of ["p", "t", "g", "m", "o"]) {
    const v = params[k];
    if (typeof v === "string") q.set(k, v);
  }
  return <ScoutPage initialFocus={focusFromSearch(q)} />;
}
