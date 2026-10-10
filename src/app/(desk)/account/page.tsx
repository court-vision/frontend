import type { Metadata } from "next";
import { AccountPage } from "@/components/account/AccountPage";
import { focusFromSearch, yahooReturn } from "@/lib/account";

export const metadata: Metadata = {
  title: "Account",
  description: "Your teams, the ESPN and Yahoo accounts they read through, and lineup alerts.",
  robots: { index: false, follow: false },
};

const READ = ["t", "c", "v", "yahoo_connected", "yahoo_connection", "yahoo_error"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const p = new URLSearchParams();
  for (const key of READ) {
    const v = params[key];
    if (typeof v === "string") p.set(key, v);
  }
  return <AccountPage demo={"demo" in params} initial={{ focus: focusFromSearch(p), yahoo: yahooReturn(p), add: "add" in params }} />;
}
