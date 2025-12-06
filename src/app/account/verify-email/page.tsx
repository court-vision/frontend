"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});
function VerifyEmailComponent() {
  const { email, sendVerificationEmail, checkCode } = useAuth();
  const searchParams = useSearchParams();
  const email_param = searchParams.get("email");
  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const success = await checkCode(email_param!!, data.pin);
    if (success) {
      // Redirect to the account page
      router.push("/account");
    }
  }

  function handleResendEmail() {
    if (email !== "" && email_param === email) {
      sendVerificationEmail(email_param!!);
    }
  }

  return (
    <>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Verify Your Email</h1>
      </div>
      <div className="flex flex-1 justify-center rounded-lg border border-primary border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 mt-[10%]">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-6"
            >
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-center items-center gap-2">
                    <FormLabel className="text-center">
                      Email Verification Code
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center justify-center">
                        <InputOTP maxLength={6} {...field}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Please enter the code sent to
                      <span className="font-semibold"> {email_param}</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-center">
                <a
                  className="text-blue-500 cursor-pointer underline text-xs hover:no-underline"
                  onClick={handleResendEmail}
                >
                  Resend Email
                </a>
              </div>
              <div className="flex justify-center">
                <Button variant="default">Submit</Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </>
  );
}

// Wrap the component with Suspense
export default function VerifyEmail() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailComponent />
    </Suspense>
  );
}