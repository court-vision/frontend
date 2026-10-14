import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/AuthPage";

export const metadata: Metadata = { title: "Sign in" };

// The bare /sign-in prerenders (Clerk's form mounts in the browser); Clerk's
// own steps under it (/sign-in/factor-one, /sign-in/sso-callback) still render
// on request.
export function generateStaticParams() {
  return [{ "sign-in": [] }];
}

export default function Page() {
  return <AuthPage mode="sign-in" />;
}
