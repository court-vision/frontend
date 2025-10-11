import { create } from "zustand";

interface AuthStore {
  // Client-side auth state (complement to NextAuth session)
  isInitializing: boolean;
  setIsInitializing: (loading: boolean) => void;

  // Email verification state
  verificationEmail: string | null;
  setVerificationEmail: (email: string | null) => void;

  // Auth errors
  authError: string | null;
  setAuthError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Client-side auth state
  isInitializing: true,
  setIsInitializing: (loading) => set({ isInitializing: loading }),

  // Email verification state
  verificationEmail: null,
  setVerificationEmail: (email) => set({ verificationEmail: email }),

  // Auth errors
  authError: null,
  setAuthError: (error) => set({ authError: error }),
}));
