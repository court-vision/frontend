import { DraftRecapPage } from "@/components/draft/DraftPages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DraftRecapPage slug={id} />;
}
