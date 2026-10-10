"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList } from "lucide-react";
import { toast } from "sonner";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { focusFromSearch, focusKey, focusToSearch, providerEnabled, returnPath, sameFocus, withoutYahooReturn, type AccountFocus, type IssueTarget, type YahooReturn } from "@/lib/account";
import { yahooConnectErrorMessage } from "@/lib/yahoo-connect";
import { AccountSheet } from "./AccountSheet";
import { AddTeamTray, type AddStart } from "./AddTeamTray";
import { AlertsSheet, effectivePrefs } from "./AlertsSheet";
import { ConnectionSheet } from "./ConnectionSheet";
import { Ledger, ledgerRows, rowKey, type LedgerAction } from "./Ledger";
import { Overview } from "./Overview";
import { TeamSheet } from "./TeamSheet";
import type { AccountModel } from "./model";
import { useDemoAccount, useLiveAccount } from "./useAccountModels";
import dk from "@/components/desk/desk.module.css";
import s from "./account.module.css";

const KEYS: Array<[string, string]> = [
  ["↑↓", "move"],
  ["⏎", "open"],
  ["A", "add team"],
  ["Esc", "overview"],
  ["T", "theme"],
];

const START_PROVIDER: AddStart = { step: "provider" };

export interface AccountInitial {
  focus: AccountFocus;
  yahoo: YahooReturn | null;
  /** `?add`: open the add-team flow on arrival. */
  add: boolean;
}

export function AccountPage({ demo, initial }: { demo: boolean; initial: AccountInitial }) {
  return demo ? <DemoAccount initial={initial} /> : <LiveAccount initial={initial} />;
}

function LiveAccount({ initial }: { initial: AccountInitial }) {
  return <AccountDesk model={useLiveAccount()} initial={initial} />;
}

function DemoAccount({ initial }: { initial: AccountInitial }) {
  return <AccountDesk model={useDemoAccount()} initial={initial} />;
}

function AccountDesk({ model, initial }: { model: AccountModel; initial: AccountInitial }) {
  const pathname = usePathname();
  const demo = model.demo;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [focus, setFocusState] = useState<AccountFocus>(initial.focus);
  const [pane, setPane] = useState<"list" | "sheet">(initial.focus.kind === "overview" ? "list" : "sheet");
  const [cursor, setCursor] = useState(0);
  const [add, setAdd] = useState<AddStart | null>(initial.add ? START_PROVIDER : null);
  const [arrival, setArrival] = useState<YahooReturn | null>(initial.yahoo);
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const sheet = useRef<HTMLElement>(null);

  const prefs = model.usePrefs();
  const teamPrefs = model.useTeamPrefs();
  const alertsOn = prefs.data ? prefs.data.lineup_alerts_enabled : null;

  const rows = useMemo(() => ledgerRows(model.teams, model.connections), [model.teams, model.connections]);

  // ---- URL

  const sync = useCallback(
    (next: AccountFocus, mode: "push" | "replace") => {
      const q = new URLSearchParams(focusToSearch(next));
      if (demo) q.set("demo", "");
      const qs = q.toString().replace(/=(&|$)/g, "$1");
      const url = `${pathname}${qs ? `?${qs}` : ""}`;
      if (`${window.location.pathname}${window.location.search}` === url) return;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [pathname, demo]
  );

  const open = useCallback(
    (next: AccountFocus) => {
      setFocusState(next);
      setPane(next.kind === "overview" ? "list" : "sheet");
      const i = rows.findIndex((r) => "focus" in r && sameFocus(r.focus, next));
      if (i >= 0) setCursor(i);
      sync(next, "push");
    },
    [rows, sync]
  );

  useEffect(() => {
    const onPop = () => {
      const f = focusFromSearch(new URLSearchParams(window.location.search));
      setFocusState(f);
      setPane(f.kind === "overview" ? "list" : "sheet");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    sheet.current?.scrollTo({ top: 0 });
  }, [focus]);

  // ---- back from Yahoo: the callback appended its verdict to this URL

  useEffect(() => {
    if (!arrival) return;
    setArrival(null);
    const clean = withoutYahooReturn(new URLSearchParams(window.location.search));
    const qs = clean.toString().replace(/=(&|$)/g, "$1");
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    if (arrival.kind !== "connected") {
      toast.error(yahooConnectErrorMessage(arrival.code));
    } else if (focus.kind === "connection" && focus.id === arrival.connectionId) {
      // A reconnect started from the account's own sheet: it is back, nothing to pick.
      toast.success("Yahoo account reconnected.");
    } else {
      toast.success("Yahoo account connected. Pick the league and the team.");
      setAdd({ step: "yahoo-league", connectionId: arrival.connectionId });
    }
    // `focus` is the page's focus at arrival; the effect runs once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival]);

  // ---- a team or an account that is gone (removed, or never there) falls back to the overview

  useEffect(() => {
    if (model.status !== "ready") return;
    const gone =
      (focus.kind === "team" && !model.teams.some((t) => t.team_id === focus.id)) ||
      (focus.kind === "connection" && !model.connections.some((c) => c.id === focus.id));
    if (gone) {
      setFocusState({ kind: "overview" });
      setPane("list");
      sync({ kind: "overview" }, "replace");
    }
  }, [focus, model.status, model.teams, model.connections, sync]);

  // ---- actions

  const onAction = useCallback(
    (action: LedgerAction) => {
      if (action.kind === "add") setAdd(START_PROVIDER);
      else if (providerEnabled(action.provider)) setAdd({ step: action.provider === "espn" ? "espn-connect" : "yahoo-connect" });
    },
    []
  );

  const onTarget = useCallback(
    (target: IssueTarget) => {
      if (target.kind === "add") setAdd(START_PROVIDER);
      else open(target);
    },
    [open]
  );

  const returnTo = useMemo(() => returnPath(pathname, new URLSearchParams(focusToSearch(focus)), ["t", "c", "v"]), [pathname, focus]);

  // ---- keys

  const latest = useRef({ rows, cursor, add, focus });
  latest.current = { rows, cursor, add, focus };
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    };
    const inDialog = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('[role="dialog"]');
    const onKey = (e: KeyboardEvent) => {
      const L = latest.current;
      if (L.add || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || inDialog(e.target)) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setCursor((c) => Math.min(L.rows.length - 1, c + 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button")) return;
        const row = L.rows[L.cursor];
        if (!row) return;
        e.preventDefault();
        if ("focus" in row) open(row.focus);
        else onAction(row.action);
      } else if (e.key === "Escape") {
        if (L.focus.kind !== "overview") open({ kind: "overview" });
      } else if (e.key === "a" || e.key === "A") {
        setAdd(START_PROVIDER);
      } else if (e.key === "t" || e.key === "T") {
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onAction, toggleTheme]);

  // ---- the sheet

  const team = focus.kind === "team" ? (model.teams.find((t) => t.team_id === focus.id) ?? null) : null;
  const connection = focus.kind === "connection" ? (model.connections.find((c) => c.id === focus.id) ?? null) : null;
  const loading = model.status === "loading";

  let body: React.ReactNode;
  if (model.status === "signed-out") {
    body = (
      <div className={s.hero}>
        <span className={s.heroTitle}>Sign in to see your account</span>
        <span className={s.heroSub}>Your teams, the ESPN and Yahoo accounts they read through, and the alerts are all yours alone.</span>
        <div className={s.linkRow}>
          <Link href="/sign-in?redirect_url=%2Faccount" className={`${dk.btn} ${dk.btnPrimary}`}>
            Sign in
          </Link>
          <Link href="/account?demo" className={dk.btn}>
            See the demo
          </Link>
        </div>
      </div>
    );
  } else if (model.status === "error") {
    body = (
      <div className={s.hero}>
        <span className={s.heroTitle}>Your account could not be loaded</span>
        <span className={s.heroSub}>{model.message}</span>
        <div className={s.linkRow}>
          <button type="button" className={dk.btn} onClick={model.refetch}>
            Try again
          </button>
        </div>
      </div>
    );
  } else if (team) {
    const override = (teamPrefs.data ?? []).find((p) => p.team_id === team.team_id);
    body = (
      <TeamSheet
        key={team.team_id}
        model={model}
        team={team}
        alerts={prefs.data ? { on: effectivePrefs(prefs.data, override).lineup_alerts_enabled, custom: !!override?.has_override } : null}
        onOpen={open}
        onRemoved={() => open({ kind: "overview" })}
      />
    );
  } else if (connection) {
    body = (
      <ConnectionSheet
        key={connection.id}
        model={model}
        connection={connection}
        onOpen={open}
        onRefresh={() => setAdd({ step: "espn-connect", connectionId: connection.id, refresh: true })}
        onAddYahoo={() => setAdd({ step: "yahoo-league", connectionId: connection.id })}
        onRemoved={() => open({ kind: "overview" })}
        returnTo={returnTo}
      />
    );
  } else if (focus.kind === "alerts") {
    body = <AlertsSheet model={model} />;
  } else if (focus.kind === "account") {
    body = <AccountSheet model={model} />;
  } else if (loading) {
    body = (
      <div className={s.ledgerSkel} style={{ padding: 22 }} aria-busy>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={dk.skel} style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    );
  } else {
    body = <Overview model={model} alertsOn={alertsOn} onOpen={open} onAdd={() => setAdd(START_PROVIDER)} onTarget={onTarget} />;
  }

  const teamsLine = loading ? "" : `${model.teams.length} ${model.teams.length === 1 ? "team" : "teams"} · ${model.connections.length} ${model.connections.length === 1 ? "account" : "accounts"}`;

  return (
    <div ref={setRoot} className={dk.desk}>
      <DeskBar desk="account" demo={demo} onRefresh={demo ? undefined : model.refetch}>
        <button type="button" className={`${dk.iconBtn} ${s.listToggle}`} aria-label={pane === "list" ? "Show the page" : "Show the list"} onClick={() => setPane((p) => (p === "list" ? "sheet" : "list"))}>
          <LayoutList size={14} />
        </button>
        <span style={{ fontWeight: 600 }}>{model.user?.name ?? model.user?.email ?? "Account"}</span>
        <span className={dk.sub}>{teamsLine}</span>
      </DeskBar>

      <div className={s.body} data-pane={pane}>
        <Ledger
          teams={model.teams}
          connections={model.connections}
          focus={focus}
          cursor={cursor}
          rows={rows}
          alertsOn={alertsOn}
          email={model.user?.email ?? null}
          loading={loading}
          onOpen={open}
          onAction={onAction}
          onCursor={setCursor}
        />
        <main ref={sheet} className={s.sheet} tabIndex={-1} aria-label={focusKey(focus)}>
          {body}
        </main>
      </div>

      <DeskStatus keys={KEYS}>{demo ? <span>Demo · a sample account · nothing is saved</span> : null}</DeskStatus>

      {root ? (
        <AddTeamTray
          open={add != null}
          onOpenChange={(o) => {
            if (!o) setAdd(null);
          }}
          model={model}
          start={add ?? START_PROVIDER}
          returnTo={returnTo}
          onAdded={(added) => {
            model.selectTeam(added.teamId);
            open({ kind: "team", id: added.teamId });
          }}
        />
      ) : null}
    </div>
  );
}
