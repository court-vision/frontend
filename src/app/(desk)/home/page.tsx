import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";

export const metadata: Metadata = {
  title: "Home",
  description: "Every fantasy team you manage at a glance: which need you tonight, how each matchup stands, and what is already taken care of.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <HomePage demo={"demo" in params} />;
}
