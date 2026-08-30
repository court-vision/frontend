import { auth } from "@clerk/nextjs/server";
import { DashboardView } from "@/components/dashboard/core/DashboardView";
import { WelcomeView } from "@/components/dashboard/WelcomeView";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <WelcomeView />;
  }

  return <DashboardView />;
}
