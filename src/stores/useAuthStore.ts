import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthStore {
  // Auth State
  token: string | null;
  isLoggedIn: boolean;
  authEmail: string | null;
  loading: boolean;
  page: string;

  // Actions
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
