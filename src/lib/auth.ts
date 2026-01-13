/**
 * Auth utilities for Clerk authentication.
 *
 * MIGRATION NOTE: This file has been updated to work with Clerk.
 * The old localStorage-based token retrieval has been replaced with
 * a function that accepts a Clerk getToken function.
 */

// Type for Clerk's getToken function
export type GetTokenFn = () => Promise<string | null>;

/**
 * Build auth headers using a Clerk token getter function.
 * This should be called from components that have access to Clerk's useAuth().
 *
 * @param getToken - Clerk's getToken function from useAuth()
 * @returns Headers object with Authorization bearer token
 */
export async function buildAuthHeaders(
  getToken: GetTokenFn
): Promise<Record<string, string>> {
  const token = await getToken();

  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  return {
    "Content-Type": "application/json",
  };
}

/**
 * @deprecated Use buildAuthHeaders with Clerk's getToken instead.
 * This function is kept for backward compatibility during migration.
 */
export async function getClientAuthHeaders(): Promise<Record<string, string>> {
  // This function no longer works with Clerk.
  // Components should use buildAuthHeaders with Clerk's getToken instead.
  console.warn(
    "getClientAuthHeaders is deprecated. Use buildAuthHeaders with Clerk's getToken instead."
  );

  return {
    "Content-Type": "application/json",
  };
}