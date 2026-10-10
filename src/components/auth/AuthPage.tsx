"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { SignIn, SignUp } from "@clerk/nextjs";
import { ThemePicker } from "@/components/desk/ThemePicker";
import { ACCOUNT_DESK, WEEK_DESK } from "@/components/desk/routes";
import { useDeskScheme, useDeskTheme } from "@/components/desk/useDeskTheme";
import { CourtField } from "@/components/landing/CourtField";
import { STAT_WALL } from "@/components/landing/stat-wall";
import s from "./auth.module.css";

/**
 * Sign-in and sign-up: Clerk's own forms (every step: social sign-in, email
 * codes, a second factor, password reset) dressed in the desk theme, beside
 * the landing's ball.
 *
 * Clerk derives its shades (hover, focus, disabled) from real colours, not
 * CSS variables, so the theme's tokens are read off the page and handed to
 * it, and read again whenever the theme changes.
 */
const TOKENS = ["--accent", "--accent-ink", "--raised", "--surface", "--surface-2", "--text", "--text-3", "--line-2", "--down", "--up", "--warn"] as const;
type Tokens = Record<(typeof TOKENS)[number], string>;

function appearanceFor(t: Tokens) {
  return {
    variables: {
      colorPrimary: t["--accent"],
      colorPrimaryForeground: t["--accent-ink"],
      colorBackground: t["--raised"],
      colorForeground: t["--text"],
      colorMuted: t["--surface-2"],
      colorMutedForeground: t["--text-3"],
      colorNeutral: t["--text"],
      colorInput: t["--surface"],
      colorInputForeground: t["--text"],
      colorBorder: t["--line-2"],
      colorRing: t["--accent"],
      colorDanger: t["--down"],
      colorSuccess: t["--up"],
      colorWarning: t["--warn"],
      fontFamily: "var(--desk-sans), ui-sans-serif, system-ui, sans-serif",
      fontFamilyButtons: "var(--desk-sans), ui-sans-serif, system-ui, sans-serif",
      fontSize: "14px",
      borderRadius: "8px",
    },
    layout: {
      logoPlacement: "none" as const,
      socialButtonsPlacement: "top" as const,
    },
    elements: {
      cardBox: { boxShadow: "var(--shadow)", border: "0" },
      formButtonPrimary: { boxShadow: "var(--glow)" },
      headerTitle: {
        fontFamily: "var(--font-outfit), var(--desk-sans), sans-serif",
        fontWeight: 800,
        fontSize: "24px",
        letterSpacing: "-0.04em",
      },
    },
  };
}

function readTokens(el: HTMLElement): Tokens {
  const cs = getComputedStyle(el);
  return Object.fromEntries(TOKENS.map((k) => [k, cs.getPropertyValue(k).trim()])) as Tokens;
}

const noop = () => () => {};

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const scheme = useDeskScheme();
  const theme = useDeskTheme((st) => st.theme);
  const page = useRef<HTMLDivElement>(null);
  // Clerk's form renders one shape on the server and another once its script
  // has loaded, so it only mounts in the browser; a card-sized space holds its
  // place until the theme's colours have been read.
  const inBrowser = useSyncExternalStore(noop, () => true, () => false);
  const [tokens, setTokens] = useState<{ theme: string; tokens: Tokens } | null>(null);

  useEffect(() => {
    if (page.current) setTokens({ theme, tokens: readTokens(page.current) });
  }, [theme]);

  const appearance = inBrowser && tokens ? appearanceFor(tokens.tokens) : null;

  return (
    <div ref={page} className={s.page} data-scheme={scheme}>
      <pre className={s.wall} aria-hidden>
        {STAT_WALL}
      </pre>
      <CourtField className={s.field} cycle={false} across={0.72} />
      <header className={s.top}>
        <Link href="/" className={s.mark} aria-label="Court Vision">
          <span aria-hidden>
            COURT<span className={s.markAccent}>VISION</span>
          </span>
        </Link>
        <ThemePicker />
      </header>
      <main className={s.main}>
        {!appearance ? (
          <div className={s.formSpace} aria-hidden />
        ) : mode === "sign-in" ? (
          <SignIn appearance={appearance} routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl={WEEK_DESK} />
        ) : (
          <SignUp
            appearance={appearance}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl={`${ACCOUNT_DESK}?add`}
          />
        )}
      </main>
    </div>
  );
}
