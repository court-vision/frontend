"use client";

import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Account() {
  const { user, isLoaded } = useUser();
  const { resolvedTheme } = useTheme();

  const clerkAppearance = {
    baseTheme: resolvedTheme === "dark" ? dark : undefined,
    elements: {
      rootBox: "mx-auto",
      card: "bg-background border border-primary shadow-lg",
      headerTitle: "text-foreground",
      headerSubtitle: "text-muted-foreground",
      formFieldLabel: "text-foreground",
      formFieldInput:
        "bg-background border-input text-foreground placeholder:text-muted-foreground",
      formButtonPrimary:
        "bg-primary text-primary-foreground hover:bg-primary/90",
      footerActionLink: "text-primary hover:text-primary/90",
      socialButtonsBlockButton:
        "bg-background border border-input text-foreground hover:bg-muted",
      socialButtonsBlockButtonText: "text-foreground",
      dividerLine: "bg-border",
      dividerText: "text-muted-foreground",
      formFieldInputShowPasswordButton: "text-muted-foreground",
      identityPreviewText: "text-foreground",
      identityPreviewEditButton: "text-primary",
      formResendCodeLink: "text-primary",
      otpCodeFieldInput: "border-input text-foreground",
      footerActionText: "text-muted-foreground",
      formFieldAction: "text-primary",
      formFieldHintText: "text-muted-foreground",
      alertText: "text-foreground",
      formFieldSuccessText: "text-green-500",
      formFieldErrorText: "text-destructive",
    },
  };

  if (!isLoaded) {
    return (
      <div className="space-y-4 animate-slide-up-fade">
        <section>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Account
          </h1>
        </section>
        <Skeleton className="w-full max-w-md h-64 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <section>
        <h1 className="font-display text-xl font-bold tracking-tight">
          Account
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Manage your profile and settings.
        </p>
      </section>

      <SignedOut>
        <div className="flex justify-center py-8">
          <SignIn routing="hash" appearance={clerkAppearance} />
        </div>
      </SignedOut>

      <SignedIn>
        <Card variant="panel" className="max-w-lg">
          <CardHeader className="flex flex-row items-center gap-4">
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                baseTheme: resolvedTheme === "dark" ? dark : undefined,
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
            />
            <div className="flex flex-col">
              <CardTitle className="text-sm font-semibold">
                Welcome back!
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </span>
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            <Separator className="mb-4" />
            <p className="text-xs text-muted-foreground">
              Click your profile picture to manage your account, sign out, or update your profile.
            </p>
          </CardContent>
          <CardFooter className="border-t border-border px-4 py-2.5">
            <span className="text-[10px] text-muted-foreground/50">
              Account managed by Clerk
            </span>
          </CardFooter>
        </Card>
      </SignedIn>
    </div>
  );
}
