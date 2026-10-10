import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <AuthPage mode="sign-in" />;
}
