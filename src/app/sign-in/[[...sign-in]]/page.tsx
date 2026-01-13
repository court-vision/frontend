import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex justify-center items-center min-h-[60vh] py-8">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-background border border-primary shadow-lg",
            headerTitle: "text-foreground",
            headerSubtitle: "text-muted-foreground",
            formFieldLabel: "text-foreground",
            formFieldInput: "bg-background border-input",
            formButtonPrimary:
              "bg-primary text-primary-foreground hover:bg-primary/90",
            footerActionLink: "text-primary hover:text-primary/90",
          },
        }}
      />
    </div>
  );
}
