import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = { title: "Create an account" };

// The bare /sign-up prerenders (Clerk's form mounts in the browser); Clerk's
// own steps under it (/sign-up/verify-email-address, /sign-up/sso-callback)
// still render on request.
export function generateStaticParams() {
  return [{ "sign-up": [] }];
}

export default function Page() {
  return <AuthPage mode="sign-up" />;
}
