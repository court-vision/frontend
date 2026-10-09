"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ESPN_COOKIE_BOOKMARKLET, decodeSwid, parseCookieString, type EspnCookies } from "@/lib/espn-cookies";
import { userMessage } from "@/lib/api-error";
import type { ConnectResult } from "./model";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

interface EspnConnectFormProps {
  connect: (body: { espn_s2: string; swid: string }) => Promise<ConnectResult>;
  onDone: (result: ConnectResult) => void;
  /** Updating an account already connected: the hint says which. */
  refreshHint?: string | null;
  /** Rendered before the submit button, e.g. a way out to the manual form. */
  aside?: React.ReactNode;
  submitLabel?: string;
}

/**
 * The one form that takes ESPN's two cookies: paste what the bookmarklet
 * offers, or the two values on their own. The backend checks them against
 * ESPN before anything is saved and says what it found; a refusal stays in
 * the form, where the fix is.
 */
export function EspnConnectForm({ connect, onDone, refreshHint, aside, submitLabel = "Check and save" }: EspnConnectFormProps) {
  const [mode, setMode] = useState<"paste" | "fields">("paste");
  const [pasted, setPasted] = useState("");
  const [s2, setS2] = useState("");
  const [swid, setSwid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromPaste: EspnCookies | null = pasted.trim() ? parseCookieString(pasted) : null;
  const cookies: EspnCookies | null = mode === "paste" ? fromPaste : s2.trim() && swid.trim() ? { s2: s2.trim(), swid: decodeSwid(swid.trim()) } : null;

  const submit = async () => {
    if (!cookies || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await connect({ espn_s2: cookies.s2, swid: cookies.swid });
      onDone(result);
    } catch (e) {
      setError(userMessage(e, "ESPN did not answer; try again in a minute"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {refreshHint ? <div className={s.formNote}>{refreshHint}</div> : null}
      <ol className={s.steps}>
        <li>
          <div className={s.stepBody}>
            <span>Drag this to your bookmarks bar, once.</span>
            <span
              dangerouslySetInnerHTML={{
                __html: `<a href="${ESPN_COOKIE_BOOKMARKLET}" class="${s.bookmarklet}" draggable="true" onclick="event.preventDefault()">Get ESPN cookies</a>`,
              }}
            />
          </div>
        </li>
        <li>
          <div className={s.stepBody}>
            <span>Open espn.com signed in, click the bookmark, copy what it shows.</span>
          </div>
        </li>
        <li>
          <div className={s.stepBody}>
            {mode === "paste" ? (
              <>
                <textarea
                  className={s.textarea}
                  value={pasted}
                  placeholder="espn_s2=…; SWID={…}"
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => setPasted(e.target.value)}
                />
                <span className={s.fieldHint}>
                  {fromPaste ? (
                    <span style={{ color: "var(--up)" }}>Both cookies found; the SWID ends in {fromPaste.swid.replace(/[{}\s]/g, "").slice(-4).toUpperCase()}.</span>
                  ) : pasted.trim() ? (
                    "Both espn_s2 and SWID are needed; the bookmark gives them together."
                  ) : (
                    <>
                      Paste it here, or{" "}
                      <button type="button" className={dk.link} style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer" }} onClick={() => setMode("fields")}>
                        enter the two values separately
                      </button>
                      .
                    </>
                  )}
                </span>
              </>
            ) : (
              <div className={s.form}>
                <label className={s.field}>
                  <span className={s.fieldLabel}>espn_s2</span>
                  <input className={dk.input} value={s2} spellCheck={false} autoComplete="off" onChange={(e) => setS2(e.target.value)} />
                </label>
                <label className={s.field}>
                  <span className={s.fieldLabel}>SWID</span>
                  <input className={dk.input} value={swid} placeholder="{…}" spellCheck={false} autoComplete="off" onChange={(e) => setSwid(e.target.value)} />
                </label>
                <span className={`${s.fieldHint} ${s.formFull}`}>
                  Both are in your browser&apos;s cookies for espn.com.{" "}
                  <button type="button" className={dk.link} style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer" }} onClick={() => setMode("paste")}>
                    Paste them together instead
                  </button>
                  .
                </span>
              </div>
            )}
          </div>
        </li>
      </ol>
      {error ? <div className={s.formError}>{error}</div> : null}
      <div className={s.row2}>
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} disabled={!cookies || busy} onClick={() => void submit()}>
          {busy ? <Loader2 size={13} className={dk.spin} /> : null}
          {busy ? "Asking ESPN…" : submitLabel}
        </button>
        {aside}
      </div>
      <span className={s.fieldHint}>
        The cookies are checked against one of the account&apos;s private leagues before they are saved, then stored encrypted and never shown again. Every team on the account reads through them.
      </span>
    </div>
  );
}
