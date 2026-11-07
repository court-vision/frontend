import type { Metadata } from "next";
import { AiPage } from "@/components/ai/AiPage";
import { aiLocation } from "@/lib/ai-desk";

export const metadata: Metadata = {
  title: "AI",
  description: "CV AI: your fantasy assistant, answering from your teams, matchups and the free-agent pool.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  return <AiPage initial={aiLocation(one(params.v), one(params.c))} />;
}
