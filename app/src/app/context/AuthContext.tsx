"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { jwtDecode } from "jwt-decode";

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
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [page, setPage] = useState("home");

  useEffect(() => {
    let isMounted = true; // Avoids setting state if the component unmounts
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      setLoading(true);

      if (token) {
        // Check server to make sure token is valid
        const tokenValid = await authCheck(token);
        if (!tokenValid) {
          logout();
          setLoading(false);
          return;
        }

        // Check if the token is expired
        const decoded = jwtDecode<JwtPaylaod>(token);
        const exp = decoded.exp;
        const currentTime = Date.now() / 1000;
        if (exp < currentTime) {
          console.log("Token expired");
          logout();
          setLoading(false);
          return;
        }

        if (isMounted) {
          console.log("Token found");
          setIsLoggedIn(true);
          setToken(token);
          setAuthEmail(decoded.email);
        }
      }
      if (isMounted) setLoading(false);
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
      // Login to account
      try {
        // API call to login
        const response = await fetch("/api/users/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          throw new Error("Failed to login.");
        }
        const data = await response.json();

        if (data.success) {
          // Login successful
          const { access_token } = data;
          localStorage.setItem("token", access_token);
          const decoded = jwtDecode<JwtPaylaod>(access_token);
          setAuthEmail(decoded.email);

          setIsLoggedIn(true);

          toast.success("Logged in successfully.");
        } else {
          // Login failed
          toast.error("Incorrect email or password. Please try again.");
        }
      } catch (error) {
        console.log(error);
        toast.error("Internal server error. Please try again later.");
      }
      setLoading(false);
    } else {
      console.log("WHAT THE HELL");
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
      // API call to send verification email
      const response = await fetch("/api/users/verify/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password_query ? password_query : password,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to send verification email.");
      }
      const data = await response.json();
      if (data.success && data.already_in_use) {
        // Email already in use
        toast.error("You must wait before generating a new code.");
        return false;
      }
      if (data.success) {
        // Email sent successfully
        toast.success("Verification email sent successfully.");
        return true;
      } else if (data.already_in_use) {
        // Email already in use
        toast.error("This email is already in use.");
        return false;
      } else {
        // Email not sent
        toast.error("Failed to send verification email.");
        return false;
      }
    } catch (error) {
      console.log(error);
      toast.error("Internal server error. Please try again later.");
      return false;
    }
  }

  async function checkCode(email: string, code: string): Promise<boolean> {
    try {
      // API call to check code
      const response = await fetch("/api/users/verify/check-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email, code: code }),
      });
      if (!response.ok) {
        throw new Error("Failed to check code.");
      }
      const data = await response.json();
      if (data.already_exists) {
        // Code is correct but the account already exists... somehow
        toast.success("Account already exists.");
        return false;
      } else if (data.valid) {
        // Code is correct and account is created
        toast.success("Email verified!");
        const { access_token } = data;
        localStorage.setItem("token", access_token);
        const decoded = jwtDecode<JwtPaylaod>(access_token);
        setAuthEmail(decoded.email);

        setIsLoggedIn(true);
        return true;
      } else {
        // Code is incorrect
        toast.error("Code is incorrect or expired.");
        return false;
      }
    } catch (error) {
      console.log(error);
      toast.error("Internal server error. Please try again later.");
      return false;
    }
  }

  async function authCheck(token: string): Promise<boolean> {
    try {
      // API call to check token
      const response = await fetch("/api/users/verify/auth-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: token }),
      });
      if (!response.ok) {
        throw new Error("Failed to check token.");
      }
      const data = await response.json();
      if (data.success) {
        // Token is valid
        toast.success("Logged In.");
        return true;
      } else {
        // Token is invalid
        toast.error("Invalid token.");
        return false;
      }
    } catch (error) {
      toast.error("Internal server error. Please try again later.");
      console.log(error);
      return false;
    }
  }

  async function deleteAccount(password: string): Promise<boolean> {
    try {
      // API call to delete account
      const token = localStorage.getItem("token");
      const response = await fetch("/api/users/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: password }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete account.");
      }
      const data = await response.json();
      if (data.success) {
        // Account deleted successfully
        toast.success("Account deleted successfully.");
        logout();
        return true;
      } else {
        // Account not deleted
        toast.error("Failed to delete account.");
        return false;
      }
    } catch (error) {
      console.log(error);
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
