/**
 * DEPRECATED: Email verification page
 *
 * This page is no longer used - Clerk handles email verification automatically.
 * Keeping for reference during migration.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmail() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the sign-up page since Clerk handles verification
    router.replace("/sign-up");
  }, [router]);

  return (
    <div className="flex flex-1 justify-center items-center">
      <p className="text-muted-foreground">
        Redirecting to sign up... Email verification is now handled by Clerk.
      </p>
    </div>
  );
}
