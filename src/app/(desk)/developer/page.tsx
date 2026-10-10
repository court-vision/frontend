import type { Metadata } from "next";
import { DevPage } from "@/components/dev/DevPage";
import { devInitial } from "@/components/dev/views";

export const metadata: Metadata = {
  title: "Developer",
  description: "The Court Vision API: reference, playground, keys and the query builder.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <DevPage demo={"demo" in params} initial={devInitial(params)} />;
}
