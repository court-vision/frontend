import NextAuth from "next-auth";

declare module "next-auth" {
  interface User {
    token?: string;
    type?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
    };
    accessToken?: string;
    type?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    accessToken?: string;
    type?: string;
  }
}
