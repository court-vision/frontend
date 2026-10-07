import type { Metadata } from "next";
import { WeekPage } from "@/components/week/WeekPage";

export const metadata: Metadata = {
  title: "Week",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "players" || params.view === "matchup" || params.view === "daily" ? params.view : undefined;
  return <WeekPage demo={"demo" in params} view={view} />;
}
