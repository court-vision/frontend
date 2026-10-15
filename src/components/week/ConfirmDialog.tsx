"use client";

import * as Dialog from "@radix-ui/react-dialog";
import dk from "@/components/desk/desk.module.css";
import s from "./week.module.css";

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  title: string;
  body: string;
  lines: Array<{ key: string; left: React.ReactNode; right?: React.ReactNode }>;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onOpenChange, container, title, body, lines, confirmLabel, busy, error, onConfirm }: ConfirmProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className={dk.overlay} />
        <Dialog.Content className={dk.dialog}>
          <div className={dk.dialogBody}>
            <Dialog.Title className={dk.dialogTitle}>{title}</Dialog.Title>
            <Dialog.Description className={dk.dialogText}>{body}</Dialog.Description>
            <div className={s.changeList}>
              {lines.map((l) => (
                <div key={l.key} className={s.change}>
                  <span className={dk.grow}>{l.left}</span>
                  {l.right}
                </div>
              ))}
            </div>
            {error ? <span className={dk.error}>{error}</span> : null}
          </div>
          <div className={dk.dialogFoot}>
            <Dialog.Close asChild>
              <button type="button" className={dk.btn}>
                Cancel
              </button>
            </Dialog.Close>
            <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={onConfirm} disabled={busy}>
              {busy ? "Sending…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
