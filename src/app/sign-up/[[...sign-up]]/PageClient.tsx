"use client";

import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";

export default function SignUpPage() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex justify-center items-center min-h-[60vh] py-8">
      <SignUp
        appearance={{
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
        }}
      />
    </div>
  );
}
