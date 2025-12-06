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
  // We keep email/password local state here for the login forms
  // as it doesn't need to be global in the store
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
