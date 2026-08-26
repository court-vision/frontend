import { create } from "zustand";

/**
 * Open/closed state of the keyboard-shortcut overlay. Lives in a store (not
 * component state) so the command palette can open it on phones, where `?`
 * has no key to press.
 */
interface ShortcutOverlayStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useShortcutOverlayStore = create<ShortcutOverlayStore>()((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
