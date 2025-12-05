import { getServerSession } from "next-auth/next";
import { getSession } from "next-auth/react";
import { BACKEND_ENDPOINT } from "@/endpoints";
import { ApiStatus, VerifyEmailResponse, CheckCodeResponse } from "@/types/api";

// Server-side auth helpers
export async function getServerAuthHeaders() {
  const session = await getServerSession();

  if (!session?.accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
}

// Client-side auth helpers
export async function getClientAuthHeaders() {
  // Try getting token from localStorage first (for custom auth)
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
    }
  }

  const session = await getSession();

  if (!session?.accessToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };
}

// Email verification helpers
export async function sendVerificationEmail(
  email: string,
  password?: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/db/users/verify/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: password,
        }),
      }
    );

    if (!response.ok) {
      return false;
    }

    const data: VerifyEmailResponse = await response.json();
    return data.status === ApiStatus.SUCCESS;
  } catch (error) {
    console.error("Error sending verification email:", error);
    return false;
  }
}

export async function checkVerificationCode(
  email: string,
  code: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/db/users/verify/check-code`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
        }),
      }
    );

    if (!response.ok) {
      return false;
    }

    const data: CheckCodeResponse = await response.json();
    return data.status === ApiStatus.SUCCESS;
  } catch (error) {
    console.error("Error checking verification code:", error);
    return false;
  }
}

export async function deleteUserAccount(password: string): Promise<boolean> {
  try {
    const headers = await getClientAuthHeaders();

    if (!headers.Authorization) {
      return false;
    }

    const response = await fetch(`${BACKEND_ENDPOINT}/db/users/delete`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        password,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error deleting account:", error);
    return false;
  }
}

// Auth check helper
export async function checkAuthStatus(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/db/users/verify/auth-check`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.status === ApiStatus.SUCCESS;
  } catch (error) {
    console.error("Error checking auth status:", error);
    return false;
  }
}
