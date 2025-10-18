import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

// Define Zod schemas
const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" }),
});

const createSchema = z
  .object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function UserLoginOrCreate() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleTabChange = () => {
    // Clear form data
    loginForm.reset();
    createForm.reset();
  };

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLoginSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password, "LOGIN");
      // AuthContext will handle the success/error messages and state updates
    } catch (error) {
      toast.error("An error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubmit = async (data: z.infer<typeof createSchema>) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password, "CREATE");
      // If successful, redirect to verification screen
      router.push(
        `/account/verify-email?email=${encodeURIComponent(data.email)}`
      );
    } catch (error) {
      toast.error("An error occurred during account creation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center mt-5">
      <Tabs onValueChange={handleTabChange} defaultValue="login">
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="create">Create</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="login">
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-2xl">Login</CardTitle>
                <CardDescription>
                  Enter your email and password below to login to your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Form {...loginForm}>
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
                  >
                    <div className="grid gap-2">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel>
                                Email
                                <span style={{ color: "red" }}> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="m@example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    <div className="grid gap-2">
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel>
                                Password
                                <span style={{ color: "red" }}> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="************"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="create">
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-2xl">Signup</CardTitle>
                <CardDescription>
                  Enter an email and matching passwords to create your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Form {...createForm}>
                  <form
                    className="flex flex-col gap-3"
                    onSubmit={createForm.handleSubmit(handleCreateSubmit)}
                  >
                    <div className="grid gap-2">
                      <FormField
                        control={createForm.control}
                        name="email"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel>
                                Email
                                <span style={{ color: "red" }}> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="m@example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <FormField
                        control={createForm.control}
                        name="password"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel>
                                Password
                                <span style={{ color: "red" }}> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="************"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>

                    <div className="grid gap-2">
                      <FormField
                        control={createForm.control}
                        name="confirmPassword"
                        render={({ field }) => {
                          return (
                            <FormItem>
                              <FormLabel>
                                Confirm Password
                                <span style={{ color: "red" }}> *</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder="************"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
