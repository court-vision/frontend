"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { useDeskTheme } from "./useDeskTheme";
import dk from "./desk.module.css";

const PortalContext = createContext<HTMLElement | null>(null);

/** Where a desk's popovers and dialogs portal to: inside the frame, so its tokens apply. */
export function useDeskPortal(): HTMLElement | null {
  return useContext(PortalContext);
}

/**
 * The one element every desk renders inside: tokens, theme, fonts (from the
 * layout's class) and the desk's own toasts.
 */
export function DeskFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  const theme = useDeskTheme((s) => s.theme);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    void useDeskTheme.persist.rehydrate();
  }, []);
  return (
    <div ref={setEl} className={`${dk.root} ${className ?? ""}`} data-theme={theme}>
      <PortalContext.Provider value={el}>{children}</PortalContext.Provider>
      <Toaster
        theme={theme}
        position="bottom-right"
        offset={40}
        gap={8}
        icons={{
          success: <CheckCircle2 size={14} />,
          error: <XCircle size={14} />,
          warning: <AlertTriangle size={14} />,
          info: <Info size={14} />,
          loading: <Loader2 size={14} className={dk.spin} />,
        }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: dk.toast,
            title: dk.toastTitle,
            description: dk.toastDescription,
            icon: dk.toastIcon,
            actionButton: dk.toastAction,
            cancelButton: dk.toastAction,
          },
        }}
      />
    </div>
  );
}
