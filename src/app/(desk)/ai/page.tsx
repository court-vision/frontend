import type { Metadata } from "next";
import { AiPage } from "@/components/ai/AiPage";

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
  const c = typeof params.c === "string" ? Number(params.c) : NaN;
  return <AiPage initialConversation={Number.isInteger(c) && c > 0 ? c : null} />;
}
