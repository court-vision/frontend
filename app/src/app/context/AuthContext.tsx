"use client";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { jwtDecode } from "jwt-decode";
import { AUTH_API, USERS_API } from "@/endpoints";
import type {
  VerifyEmailResponse,
  CheckCodeResponse,
  LoginResponse,
  AuthCheckResponse,
} from "@/types/auth";

const AuthContext = createContext({
  email: "",
  setEmail: (email: string) => {},
  password: "",
  setPassword: (password: string) => {},
  token: "",
  isLoggedIn: false,
  setIsLoggedIn: (isLoggedIn: boolean) => {},
  authEmail: "",
  loading: true,
  setLoading: (loading: boolean) => {},
  setAuthEmail: (email: string) => {},
  page: "home",
  setPage: (page: string) => {},
  login: (email: string, password: string, typeSumbit: string) => {},
  logout: () => {},
  sendVerificationEmail: async (email: string, password?: string) => false,
  checkCode: async (email: string, code: string) => false,
  deleteAccount: async (password: string) => false,
});

interface JwtPaylaod {
  uid: number;
  exp: number;
  email: string;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true); // Start as true for initial load
  const [token, setToken] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [page, setPage] = useState("home");

  // Ref to track if initial auth check has been performed
  // const authCheckPerformed = useRef(false);

  useEffect(() => {
    // Prevent double execution (React StrictMode or Fast Refresh)
    // if (authCheckPerformed.current) return;
    // authCheckPerformed.current = true;

    let isMounted = true;

    const checkAuth = async () => {
      const storedToken = localStorage.getItem("token");

      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      // First check if token is expired locally (fast check)
      try {
        const decoded = jwtDecode<JwtPaylaod>(storedToken);
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          console.log("Token expired locally");
          logout();
          if (isMounted) setLoading(false);
          return;
        }
      } catch {
        // Invalid token format
        logout();
        if (isMounted) setLoading(false);
        return;
      }

      // Then verify with server (no toast on session restoration)
      const tokenValid = await authCheck(storedToken, false);
      if (!tokenValid) {
        logout();
        if (isMounted) setLoading(false);
        return;
      }

      if (isMounted) {
        const decoded = jwtDecode<JwtPaylaod>(storedToken);
        setIsLoggedIn(true);
        setToken(storedToken);
        setAuthEmail(decoded.email);
        setLoading(false);
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string, typeSubmit: string) => {
    // Create account - send verification email instead of creating directly
    if (typeSubmit === "CREATE") {
      try {
        // Send verification email instead of creating account directly
        const emailSent = await sendVerificationEmail(email, password);
        if (emailSent) {
          // Store email for verification screen
          setEmail(email);
          setPassword(password);
          // Don't log in yet - wait for email verification
        }
      } catch (error) {
        toast.error("Internal server error. Please try again later.");
      }
    } else if (typeSubmit === "LOGIN") {
      setLoading(true);

      try {
        const response = await fetch(`${AUTH_API}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data: LoginResponse = await response.json();

        if (data.status === "success" && data.data?.access_token) {
          localStorage.setItem("token", data.data.access_token);
          const decoded = jwtDecode<JwtPaylaod>(data.data.access_token);
          setAuthEmail(decoded.email);
          setIsLoggedIn(true);
          toast.success("Logged in successfully.");
        } else if (data.status === "authentication_error") {
          toast.error("Incorrect email or password. Please try again.");
        } else {
          toast.error(data.message || "Login failed. Please try again.");
        }
      } catch (error) {
        console.error("Login error:", error);
        toast.error("Internal server error. Please try again later.");
      }
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
  };

  async function sendVerificationEmail(
    email: string,
    password_query?: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${AUTH_API}/verify/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password_query ?? password,
        }),
      });

      const data: VerifyEmailResponse = await response.json();

      if (data.status === "success" && data.data?.verification_sent) {
        toast.success("Verification email sent successfully.");
        return true;
      } else if (data.status === "conflict") {
        // Email already registered
        toast.error("This email is already in use.");
        return false;
      } else if (data.status === "success" && data.data?.expires_in_seconds) {
        // Verification email already sent recently
        toast.error("You must wait before generating a new code.");
        return false;
      } else {
        toast.error(data.message || "Failed to send verification email.");
        return false;
      }
    } catch (error) {
      console.error("Send verification email error:", error);
      toast.error("Internal server error. Please try again later.");
      return false;
    }
  }

  async function checkCode(email: string, code: string): Promise<boolean> {
    try {
      const response = await fetch(`${AUTH_API}/verify/check-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      const data: CheckCodeResponse = await response.json();

      if (data.status === "success" && data.data?.access_token) {
        toast.success("Email verified! Account created.");
        localStorage.setItem("token", data.data.access_token);
        const decoded = jwtDecode<JwtPaylaod>(data.data.access_token);
        setAuthEmail(decoded.email);
        setIsLoggedIn(true);
        return true;
      } else if (data.status === "authentication_error") {
        toast.error(data.message || "Code is incorrect or expired.");
        return false;
      } else if (data.status === "not_found") {
        toast.error(
          "No verification request found. Please request a new code."
        );
        return false;
      } else {
        toast.error(data.message || "Verification failed.");
        return false;
      }
    } catch (error) {
      console.error("Check code error:", error);
      toast.error("Internal server error. Please try again later.");
      return false;
    }
  }

  async function authCheck(
    token: string,
    showToast: boolean = true
  ): Promise<boolean> {
    try {
      const response = await fetch(`${AUTH_API}/verify/auth-check`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data: AuthCheckResponse = await response.json();

      if (data.status === "success" && data.error_code === "TOKEN_VALID") {
        // Only show toast for explicit login actions, not session restoration
        if (showToast) {
          toast.success("Logged in.");
        }
        return true;
      } else if (data.error_code === "TOKEN_EXPIRED") {
        if (showToast) {
          toast.error("Session expired. Please log in again.");
        }
        return false;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Auth check error:", error);
      if (showToast) {
        toast.error("Internal server error. Please try again later.");
      }
      return false;
    }
  }

  async function deleteAccount(password: string): Promise<boolean> {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Not authenticated.");
        return false;
      }

      const response = await fetch(`${USERS_API}/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.status === "success") {
        toast.success("Account deleted successfully.");
        logout();
        return true;
      } else if (data.status === "authentication_error") {
        toast.error("Incorrect password.");
        return false;
      } else {
        toast.error(data.message || "Failed to delete account.");
        return false;
      }
    } catch (error) {
      console.error("Delete account error:", error);
      toast.error("Internal server error. Please try again later.");
      return false;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        email,
        setEmail,
        password,
        setPassword,
        token,
        isLoggedIn,
        setIsLoggedIn,
        loading,
        setLoading,
        authEmail,
        setAuthEmail,
        page,
        setPage,
        login,
        logout,
        sendVerificationEmail,
        checkCode,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
