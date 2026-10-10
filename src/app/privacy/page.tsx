import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Court Vision and the Court Vision Draft Tap collect, why, and how to have it deleted.",
};

export default function Page() {
  return <PrivacyPolicy />;
}
