import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { BACKEND_ENDPOINT } from "@/endpoints";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        typeSubmit: { label: "Type", type: "text" },
      },
      async authorize(credentials) {
        if (
          !credentials?.email ||
          !credentials?.password ||
          !credentials?.typeSubmit
        ) {
          return null;
        }

        try {
          // For account creation
          if (credentials.typeSubmit === "CREATE") {
            const response = await fetch(
              `${BACKEND_ENDPOINT}/db/users/verify/send-email`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  email: credentials.email,
                  password: credentials.password,
                }),
              }
            );

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.message || "Failed to send verification email"
              );
            }

            const data = await response.json();

            if (data.status !== "success") {
              throw new Error(
                data.message || "Failed to send verification email"
              );
            }

            // After successful email verification request, we need to verify email
            return {
              id: "pending",
              email: credentials.email,
              type: "CREATE",
            };
          }

          // For login
          if (credentials.typeSubmit === "LOGIN") {
            const response = await fetch(`${BACKEND_ENDPOINT}/db/users/login`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            });

            if (!response.ok) {
              throw new Error("Invalid credentials");
            }

            const data = await response.json();

            if (data.status !== "success") {
              throw new Error(data.message || "Login failed");
            }

            return {
              id: data.data?.user_id?.toString() || "unknown",
              email: credentials.email,
              token: data.data?.access_token,
            };
          }

          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // If user object exists (first time signing in)
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        if (user.token) {
          token.accessToken = user.token;
        }
        if (user.type) {
          token.type = user.type;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      session.user.id = token.userId as string;
      session.accessToken = token.accessToken as string;
      session.type = token.type as string;
      return session;
    },
  },
  pages: {
    signIn: "/account",
    error: "/account",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
