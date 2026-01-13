/**
 * DEPRECATED: Custom authentication context
 *
 * This context is no longer used - authentication is now handled by Clerk.
 * Keeping for reference during migration.
 *
 * For authentication, use Clerk's components and hooks:
 * - `<ClerkProvider>` - wraps your app (already in layout.tsx)
 * - `<SignedIn>`, `<SignedOut>` - conditional rendering
 * - `<UserButton>` - user profile/sign out button
 * - `useUser()` - for user info
 * - `useAuth()` - for auth state and getToken
 */

/*
"use client";
import { createContext, useContext, useState } from "react";
import { useAuthHook } from "@/hooks/useAuth";

const AuthContext = createContext<
  ReturnType<typeof useAuthHook> & {
    email: string;
    setEmail: (email: string) => void;
    password: string;
    setPassword: (password: string) => void;
  }
>({
  email: "",
  setEmail: () => {},
  password: "",
  setPassword: () => {},
  token: null,
  isLoggedIn: false,
  authEmail: null,
  loading: true,
  page: "home",
  setPage: () => {},
  login: async () => false,
  logout: () => {},
  sendVerificationEmail: async () => false,
  checkCode: async () => false,
  deleteAccount: async () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const auth = useAuthHook();

  return (
    <AuthContext.Provider
      value={{
        email,
        setEmail,
        password,
        setPassword,
        ...auth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
*/

"use client";
import { createContext, useContext } from "react";

// Placeholder context to prevent import errors during migration
const AuthContext = createContext({
  email: "",
  setEmail: () => {},
  password: "",
  setPassword: () => {},
  token: null as string | null,
  isLoggedIn: false,
  authEmail: null as string | null,
  loading: false,
  page: "home",
  setPage: () => {},
  login: async () => false,
  logout: () => {},
  sendVerificationEmail: async () => false,
  checkCode: async () => false,
  deleteAccount: async () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
