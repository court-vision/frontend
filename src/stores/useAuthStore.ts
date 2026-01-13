/**
 * DEPRECATED: Custom auth state store
 *
 * This store is no longer used - authentication state is now managed by Clerk.
 * Keeping for reference during migration.
 *
 * For authentication state, use Clerk's hooks:
 * - `useUser()` - for user info (isSignedIn, user object)
 * - `useAuth()` - for auth state (getToken, signOut)
 */

/*
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthStore {
  token: string | null;
  isLoggedIn: boolean;
  authEmail: string | null;
  loading: boolean;
  page: string;

  setToken: (token: string | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  setAuthEmail: (email: string | null) => void;
  setLoading: (loading: boolean) => void;
  setPage: (page: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      isLoggedIn: false,
      authEmail: null,
      loading: true,
      page: "home",

      setToken: (token) => set({ token }),
      setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
      setAuthEmail: (authEmail) => set({ authEmail }),
      setLoading: (loading) => set({ loading }),
      setPage: (page) => set({ page }),
      logout: () =>
        set({
          token: null,
          isLoggedIn: false,
          authEmail: null,
          page: "home",
        }),
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        token: state.token,
        isLoggedIn: state.isLoggedIn,
        authEmail: state.authEmail,
      }),
    }
  )
);
*/

// Export placeholder to prevent import errors during migration
import { create } from "zustand";

interface DeprecatedAuthStore {
  token: null;
  isLoggedIn: false;
  authEmail: null;
  loading: false;
  page: string;
  setToken: () => void;
  setIsLoggedIn: () => void;
  setAuthEmail: () => void;
  setLoading: () => void;
  setPage: () => void;
  logout: () => void;
}

export const useAuthStore = create<DeprecatedAuthStore>()(() => ({
  token: null,
  isLoggedIn: false,
  authEmail: null,
  loading: false,
  page: "home",
  setToken: () => {},
  setIsLoggedIn: () => {},
  setAuthEmail: () => {},
  setLoading: () => {},
  setPage: () => {},
  logout: () => {},
}));
