"use client";

import { useUser } from "@clerk/nextjs";
import { DashboardView } from "@/components/dashboard/core/DashboardView";
import { WelcomeView } from "@/components/dashboard/WelcomeView";

export default function Home() {
  const { isSignedIn } = useUser();

  if (!isSignedIn) {
    return <WelcomeView />;
  }

  return <DashboardView />;
}
