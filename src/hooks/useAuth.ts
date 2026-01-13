/**
 * DEPRECATED: Custom JWT authentication hook
 *
 * This file is no longer used - authentication is now handled by Clerk.
 * Keeping for reference during migration.
 *
 * For authentication, use:
 * - `useUser()` from "@clerk/nextjs" for user info
 * - `useAuth()` from "@clerk/nextjs" for auth state and getToken
 * - `<SignedIn>`, `<SignedOut>` components for conditional rendering
 */

/*
import { useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { jwtDecode } from "jwt-decode";
import { toast } from "sonner";
import { AUTH_API, USERS_API } from "@/endpoints";
import type {
  VerifyEmailResponse,
  CheckCodeResponse,
  LoginResponse,
  AuthCheckResponse,
} from "@/types/auth";

interface JwtPayload {
  uid: number;
  exp: number;
  email: string;
}

export function useAuthHook() {
  const {
    token,
    isLoggedIn,
    authEmail,
    loading,
    page,
    setToken,
    setIsLoggedIn,
    setAuthEmail,
    setLoading,
    setPage,
    logout: storeLogout,
  } = useAuthStore();

  // Logout function that clears store and local storage
  const logout = () => {
    localStorage.removeItem("token");
    storeLogout();
  };

  // Initial Auth Check
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const storedToken = localStorage.getItem("token");

      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const decoded = jwtDecode<JwtPayload>(storedToken);
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
          console.log("Token expired locally");
          logout();
          if (isMounted) setLoading(false);
          return;
        }
      } catch {
        logout();
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${AUTH_API}/verify/auth-check`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!response.ok) {
          logout();
          if (isMounted) setLoading(false);
          return;
        }

        const data: AuthCheckResponse = await response.json();

        if (data.status === "success" && data.error_code === "TOKEN_VALID") {
          if (isMounted) {
            const decoded = jwtDecode<JwtPayload>(storedToken);
            setIsLoggedIn(true);
            setToken(storedToken);
            setAuthEmail(decoded.email);
            setLoading(false);
          }
        } else {
          logout();
          if (isMounted) setLoading(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        if (isMounted) setLoading(false);
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [setToken, setIsLoggedIn, setAuthEmail, setLoading]);

  // Login
  const login = async (email: string, password: string, typeSubmit: string): Promise<boolean> => {
    // ... implementation
    return false;
  };

  // Send Verification Email
  const sendVerificationEmail = async (email: string, password?: string): Promise<boolean> => {
    // ... implementation
    return false;
  };

  // Check Code
  const checkCode = async (email: string, code: string): Promise<boolean> => {
    // ... implementation
    return false;
  };

  // Delete Account
  const deleteAccount = async (password: string): Promise<boolean> => {
    // ... implementation
    return false;
  };

  return {
    token,
    isLoggedIn,
    authEmail,
    loading,
    page,
    setPage,
    login,
    logout,
    sendVerificationEmail,
    checkCode,
    deleteAccount,
  };
}
*/

// Export empty placeholder to prevent import errors during migration
export function useAuthHook() {
  return {
    token: null,
    isLoggedIn: false,
    authEmail: null,
    loading: false,
    page: "home",
    setPage: () => {},
    login: async () => false,
    logout: () => {},
    sendVerificationEmail: async () => false,
    checkCode: async () => false,
    deleteAccount: async () => false,
  };
}
