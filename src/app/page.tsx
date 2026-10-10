import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { WEEK_DESK } from "@/components/desk/routes";
import { Landing } from "@/components/landing/Landing";

/** The front door: the landing page signed out, your Week desk signed in. */
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect(WEEK_DESK);
  return <Landing />;
}
