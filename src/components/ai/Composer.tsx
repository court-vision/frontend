"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/** The backend's limit on one message (AGENT_MESSAGE_MAX). */
export const MAX_MESSAGE = 2000;

export interface ComposerHandle {
  focus: () => void;
  /** Put text back (a message the server refused before answering). */
  fill: (text: string) => void;
}

/**
 * The message box under the conversation. Enter sends, Shift+Enter starts a
 * new line; it grows with the text up to a few lines, then scrolls.
 */
export const Composer = forwardRef<ComposerHandle, {
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  banner?: React.ReactNode;
  onSend: (message: string) => void;
}>(function Composer({ disabled, busy, placeholder, banner, onSend }, ref) {
  const [text, setText] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    fill: (t: string) => {
      setText(t);
      area.current?.focus();
    },
  }));

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const trimmed = text.trim();
  const canSend = !disabled && !busy && trimmed.length > 0 && text.length <= MAX_MESSAGE;
  const send = () => {
    if (!canSend) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <div className={s.composer}>
      <div className={s.composerInner}>
        {banner ? <div className={s.banner}>{banner}</div> : null}
        <div className={s.box}>
          <textarea
            ref={area}
            className={s.textarea}
            rows={1}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            aria-label="Message the assistant"
            maxLength={MAX_MESSAGE + 200}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="button" className={`${dk.btn} ${dk.btnPrimary} ${dk.btnSmall}`} onClick={send} disabled={!canSend} aria-label="Send">
            <ArrowUp size={14} />
          </button>
        </div>
        <div className={s.hint}>
          <span className={s.hintKeys}>
            <span className={dk.kbd}>⏎</span> send · <span className={dk.kbd}>⇧⏎</span> new line
          </span>
          <span className={`${dk.spacer} ${s.hintKeys}`} />
          {text.length > MAX_MESSAGE ? (
            <span style={{ color: "var(--down)" }}>
              {text.length} / {MAX_MESSAGE}
            </span>
          ) : (
            <span>Numbers come from Court Vision&apos;s data. It can still be wrong: check before you act.</span>
          )}
        </div>
      </div>
    </div>
  );
});
