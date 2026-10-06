"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useDeskPortal } from "./DeskFrame";
import dk from "./desk.module.css";

interface DeskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  wide?: boolean;
  children?: React.ReactNode;
  /** The buttons; Cancel is added unless `cancelLabel` is null. */
  footer?: React.ReactNode;
  cancelLabel?: string | null;
}

/** A desk dialog: title, optional text, a body, and a footer of buttons. */
export function DeskDialog({ open, onOpenChange, title, description, wide, children, footer, cancelLabel = "Cancel" }: DeskDialogProps) {
  const container = useDeskPortal();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className={dk.overlay} />
        <Dialog.Content className={`${dk.dialog} ${wide ? dk.dialogWide : ""}`} aria-describedby={undefined}>
          <div className={dk.dialogBody}>
            <Dialog.Title className={dk.dialogTitle}>{title}</Dialog.Title>
            {description ? <div className={dk.dialogText}>{description}</div> : null}
            {children}
          </div>
          {footer || cancelLabel ? (
            <div className={dk.dialogFoot}>
              {cancelLabel ? (
                <Dialog.Close asChild>
                  <button type="button" className={dk.btn}>
                    {cancelLabel}
                  </button>
                </Dialog.Close>
              ) : null}
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
