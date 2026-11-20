"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { loadDraft, saveDraft } from "@/lib/ai-drafts";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/** The backend's limit on one message (AGENT_MESSAGE_MAX). */
export const MAX_MESSAGE = 2000;

/** How tall the box grows (px) before its text scrolls; matches `.textarea`'s max-height. */
const MAX_HEIGHT = 180;

/**
 * Fit the box to its text. scrollHeight leaves out the border, so add it back, and only
 * allow a scrollbar once the text is taller than the cap (an empty box never scrolls).
 */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  const fit = el.scrollHeight + el.offsetHeight - el.clientHeight;
  el.style.height = `${Math.min(fit, MAX_HEIGHT)}px`;
  el.style.overflowY = fit > MAX_HEIGHT ? "auto" : "hidden";
}

export interface ComposerHandle {
  focus: () => void;
  /** Put text back (a message the server refused before answering). */
  fill: (text: string) => void;
}

/**
 * The message box under the conversation. Enter sends, Shift+Enter starts a
 * new line; it grows with the text up to a few lines, then scrolls. What's
 * typed and not sent is kept per conversation (`draftKey`), so it is still
 * there after visiting another conversation or desk.
 */
export const Composer = forwardRef<ComposerHandle, {
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  banner?: React.ReactNode;
  /** Where this conversation's unsent message is kept; null keeps nothing. */
  draftKey: string | null;
  onSend: (message: string) => void;
}>(function Composer({ disabled, busy, placeholder, banner, draftKey, onSend }, ref) {
  const [text, setTextState] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const key = useRef(draftKey);

  // Another conversation: its own unsent message (read after mount, so the server render matches)
  useEffect(() => {
    key.current = draftKey;
    setTextState(loadDraft(draftKey));
  }, [draftKey]);

  const setText = (t: string) => {
    setTextState(t);
    saveDraft(key.current, t);
  };

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    fill: (t: string) => {
      setText(t);
      area.current?.focus();
    },
  }));

  useLayoutEffect(() => {
    if (area.current) fitHeight(area.current);
  }, [text]);

  // A narrower box wraps the same text onto more lines: fit again when the width changes
  // (only the width, since fitting changes the height)
  useEffect(() => {
    const el = area.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitHeight(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
