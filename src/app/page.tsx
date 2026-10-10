import { auth } from "@clerk/nextjs/server";
import { DashboardView } from "@/components/dashboard/core/DashboardView";
import { Landing } from "@/components/landing/Landing";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <Landing />;
  }

  return <DashboardView />;
}
