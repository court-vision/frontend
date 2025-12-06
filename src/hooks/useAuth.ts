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
      // We check localStorage directly for initial load to avoid hydration mismatch
      // or rely on Zustand persist (which handles localStorage).
      // However, we also need to validate validity.
      const storedToken = localStorage.getItem("token");

      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }

      // 1. Local Expiry Check
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

      // 2. Server Validation
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
        // Don't logout on network error, just stop loading
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
    if (typeSubmit === "CREATE") {
      return await sendVerificationEmail(email, password);
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
          const decoded = jwtDecode<JwtPayload>(data.data.access_token);
          
          setToken(data.data.access_token);
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
        setLoading(false);
        return false;
      }
      setLoading(false);
      return true;
    }
    return false;
  };

  // Send Verification Email
  const sendVerificationEmail = async (
    email: string,
    password?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${AUTH_API}/verify/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data: VerifyEmailResponse = await response.json();

      if (data.status === "success" && data.data?.verification_sent) {
        toast.success("Verification email sent successfully.");
        return true;
      } else if (data.status === "conflict") {
        toast.error("This email is already in use.");
        return false;
      } else if (data.status === "success" && data.data?.expires_in_seconds) {
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
  };

  // Check Code
  const checkCode = async (email: string, code: string): Promise<boolean> => {
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
        
        const decoded = jwtDecode<JwtPayload>(data.data.access_token);
        setToken(data.data.access_token);
        setAuthEmail(decoded.email);
        setIsLoggedIn(true);
        
        return true;
      } else if (data.status === "authentication_error") {
        toast.error(data.message || "Code is incorrect or expired.");
        return false;
      } else if (data.status === "not_found") {
        toast.error("No verification request found. Please request a new code.");
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
  };

  // Delete Account
  const deleteAccount = async (password: string): Promise<boolean> => {
    try {
      const currentToken = localStorage.getItem("token");
      if (!currentToken) {
        toast.error("Not authenticated.");
        return false;
      }

      const response = await fetch(`${USERS_API}/delete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentToken}`,
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
  };

  return {
    // State
    token,
    isLoggedIn,
    authEmail,
    loading,
    page,
    
    // Actions
    setPage,
    login,
    logout,
    sendVerificationEmail,
    checkCode,
    deleteAccount,
  };
}

