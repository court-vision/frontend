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
      <>
        <div className="flex items-center">
          <h1 className="text-lg font-semibold md:text-2xl">Your Account</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Skeleton className="w-full max-w-md h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center mb-4">
        <h1 className="text-lg font-semibold md:text-2xl">Your Account</h1>
      </div>

      <SignedOut>
        <div className="flex flex-1 items-start justify-center rounded-lg border border-primary border-dashed shadow-sm py-8">
          <SignIn routing="hash" appearance={clerkAppearance} />
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex flex-1 items-start rounded-lg border border-primary border-dashed shadow-sm">
          <div className="flex flex-col gap-1 w-full">
            <Card className="w-full">
              <CardHeader className="flex flex-row items-center gap-5 bg-muted/50">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    baseTheme: resolvedTheme === "dark" ? dark : undefined,
                    elements: {
                      avatarBox: "w-12 h-12",
                    },
                  }}
                />
                <div className="flex flex-col">
                  <CardTitle className="flex text-lg">
                    Welcome Court Visionary!
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 text-sm">
                <div className="grid gap-3">
                  <div className="font-semibold">Email</div>
                  <ul className="grid gap-3">
                    <li className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {user?.primaryEmailAddress?.emailAddress}
                      </span>
                    </li>
                  </ul>
                  <Separator className="my-2" />
                  <div className="font-semibold">Account</div>
                  <ul className="grid gap-3">
                    <li className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Click your profile picture above to manage your account,
                        sign out, or update your profile.
                      </span>
                    </li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3 gap-5">
                <span className="text-sm text-muted-foreground">
                  Account managed by Clerk
                </span>
              </CardFooter>
            </Card>
          </div>
        </div>
      </SignedIn>
    </>
  );
}
