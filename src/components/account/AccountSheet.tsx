"use client";

import Link from "next/link";
import { Braces, Check, LogOut, UserRoundCog } from "lucide-react";
import { DESK_THEMES } from "@/components/desk/themes";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { DEVELOPER_DESK } from "@/components/desk/routes";
import type { AccountModel } from "./model";
import { Block } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

/** The account itself: who is signed in, the ways to change that, and how the desks look. */
export function AccountSheet({ model }: { model: AccountModel }) {
  const theme = useDeskTheme((st) => st.theme);
  const setTheme = useDeskTheme((st) => st.setTheme);
  const user = model.user;
  const initials = (user?.name ?? user?.email ?? "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>Account</span>
          <span className={s.headSub}>Who is signed in, and how the desks look. Sign-in is Clerk&apos;s; Court Vision keeps only your teams, connections and alert settings against it.</span>
        </div>
      </header>

      <Block title="Signed in as">
        <div className={s.who}>
          {user?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={s.whoFace} src={user.imageUrl} alt="" draggable={false} />
          ) : (
            <span className={s.whoInitials}>{initials}</span>
          )}
          <div className={s.whoBody}>
            <span className={s.whoName}>{user?.name ?? "Signed in"}</span>
            {user?.email ? <span className={s.whoEmail}>{user.email}</span> : null}
            {model.demo ? <span className={s.fieldHint}>A sample account. Nothing here is real.</span> : null}
          </div>
        </div>
        <div className={s.linkRow} style={{ marginTop: 16 }}>
          {model.openProfile ? (
            <button type="button" className={dk.btn} onClick={model.openProfile}>
              <UserRoundCog size={13} /> Manage sign-in
            </button>
          ) : null}
          <button type="button" className={dk.btn} onClick={model.signOut}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
        {model.openProfile ? <span className={s.fieldHint} style={{ display: "block", marginTop: 10 }}>Email, password, connected sign-ins and sessions live in Clerk&apos;s own dialog.</span> : null}
      </Block>

      <Block title="Theme" note="every desk">
        <div className={s.trayOptions} style={{ maxWidth: 520 }}>
          {DESK_THEMES.map((t) => (
            <button key={t.id} type="button" className={s.trayOption} data-on={theme === t.id ? "true" : undefined} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
              <span className={s.trayOptionTitle}>
                {t.label}
                <span className={`${dk.chip} ${dk.flat}`}>{t.scheme}</span>
                {theme === t.id ? <Check size={13} className={s.trayOptionCheck} /> : null}
              </span>
              <span className={s.trayOptionSub}>{t.note}</span>
            </button>
          ))}
        </div>
        <span className={s.fieldHint} style={{ display: "block", marginTop: 8 }}>
          <span className={dk.kbd}>T</span> on any desk swaps a theme with its pair.
        </span>
      </Block>

      <Block title="Elsewhere">
        <div className={s.linkRow}>
          <Link href={model.demo ? `${DEVELOPER_DESK}?demo` : DEVELOPER_DESK} className={dk.btn}>
            <Braces size={13} /> Developer desk
          </Link>
          <Link href="/" className={dk.btn}>
            The classic site
          </Link>
        </div>
        <span className={s.fieldHint} style={{ display: "block", marginTop: 10 }}>
          API keys and the query builder live on the Developer desk.
        </span>
      </Block>
    </div>
  );
}
