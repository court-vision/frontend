"use client";

import * as React from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

/**
 * A confirm surface that is a centred dialog from `md` up and a bottom
 * drawer below it, with one set of parts so a component writes its body
 * once. The server renders the dialog branch (closed), so a phone sees no
 * flash: the switch happens before anything is open.
 *
 * Drawer mode pads the content itself (`px-4` plus the home-indicator inset);
 * a component that lays out its own edges passes `p-0` and wins.
 */
const MobileContext = React.createContext(false);

function ResponsiveDialog(props: React.ComponentProps<typeof Dialog>) {
  const mobile = useIsMobile();
  return (
    <MobileContext.Provider value={mobile}>
      {mobile ? <Drawer setBackgroundColorOnScale={false} {...props} /> : <Dialog {...props} />}
    </MobileContext.Provider>
  );
}

const ResponsiveDialogClose = (props: React.ComponentProps<typeof DialogClose>) =>
  React.useContext(MobileContext) ? <DrawerClose {...props} /> : <DialogClose {...props} />;

const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, ...props }, ref) => {
  const mobile = React.useContext(MobileContext);
  if (mobile) {
    return (
      <DrawerContent
        ref={ref}
        // A bottom drawer is always full-bleed: a caller's dialog width cap
        // (`max-w-md`) would otherwise pin it to a 448px box on the left of
        // anything wider than a phone, so it is stripped last.
        className={cn(
          "gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>*:last-child]:mt-0",
          className,
          "max-w-none"
        )}
        {...props}
      />
    );
  }
  return <DialogContent ref={ref} className={className} {...props} />;
});
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

function ResponsiveDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const mobile = React.useContext(MobileContext);
  return mobile ? (
    <DrawerHeader className={cn("px-0 pb-1 pt-3 text-left", className)} {...props} />
  ) : (
    <DialogHeader className={className} {...props} />
  );
}

function ResponsiveDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const mobile = React.useContext(MobileContext);
  return mobile ? (
    // Primary action on top, thumb-first, then the cancel below it.
    <DrawerFooter className={cn("flex-col-reverse gap-2 px-0 pb-0 pt-1", className)} {...props} />
  ) : (
    <DialogFooter className={className} {...props} />
  );
}

const ResponsiveDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogTitle>,
  React.ComponentPropsWithoutRef<typeof DialogTitle>
>((props, ref) =>
  React.useContext(MobileContext) ? <DrawerTitle ref={ref} {...props} /> : <DialogTitle ref={ref} {...props} />
);
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

const ResponsiveDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogDescription>,
  React.ComponentPropsWithoutRef<typeof DialogDescription>
>((props, ref) =>
  React.useContext(MobileContext) ? (
    <DrawerDescription ref={ref} {...props} />
  ) : (
    <DialogDescription ref={ref} {...props} />
  )
);
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
};
