import { DraftLobbyPage } from "@/components/draft/DraftPages";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <DraftLobbyPage demo={"demo" in params} />;
}
