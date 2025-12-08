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

  return {};
}