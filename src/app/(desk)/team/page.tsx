import type { Metadata } from "next";
import { TeamPage } from "@/components/team/TeamPage";

export const metadata: Metadata = {
  title: "Team",
  description: "Your fantasy team against the rest of its league, every roster projected the same way: your weeks, where your points come from, your roster by tier and the streaming line.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const w = params.w;
  return <TeamPage demo={"demo" in params} initialWindow={typeof w === "string" ? w : null} />;
}
