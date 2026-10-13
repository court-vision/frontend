import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = { title: "Create an account" };

export default function Page() {
  return <AuthPage mode="sign-up" />;
}
