"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

import { useIsMobile } from "@/hooks/useBreakpoint"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ position, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Phones: under the header, clear of the tab bar and the thumb zone.
      position={position ?? (isMobile ? "top-center" : "bottom-right")}
      mobileOffset={{ top: 56 }}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
