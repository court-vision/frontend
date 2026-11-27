import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AiPage } from "@/components/ai/AiPage";
import { AI_DESK, DRAFT_DESK } from "@/components/desk/routes";
import { aiLocation, draftsRedirect } from "@/lib/ai-desk";

export const metadata: Metadata = {
  title: "AI",
  description: "Dime: your fantasy assistant, answering from your teams, matchups and the free-agent pool.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  // Draft notes left the AI desk for each room's recap: an old link goes to the note or the rooms
  const moved = draftsRedirect(one(params.v), one(params.c), DRAFT_DESK, AI_DESK);
  if (moved) redirect(moved);
  return <AiPage initial={aiLocation(one(params.v), one(params.c), one(params.d))} demo={"demo" in params} />;
}
