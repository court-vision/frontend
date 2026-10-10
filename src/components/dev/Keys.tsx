"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { DeskDialog } from "@/components/desk/DeskDialog";
import type { ApiKeyListItem } from "@/types/api-keys";
import { Block, CopyBtn, Skeleton, ago, stamp } from "./blocks";
import type { KeysModel } from "./useDevModels";
import { useSessionKey } from "./useDevStore";
import dk from "@/components/desk/desk.module.css";
import s from "./dev.module.css";

const SCOPES: Array<{ id: string; label: string; help: string }> = [
  { id: "read", label: "read", help: "The default. Reads of your own data, when routes for it arrive." },
  { id: "analytics", label: "analytics", help: "The Analytics routes: lineup generation and breakout streamers." },
];

/** Past its expiry, by the clock now; kept out of render for the compiler's sake. */
function isExpired(k: ApiKeyListItem): boolean {
  return k.expires_at ? new Date(k.expires_at).getTime() < Date.now() : false;
}

const EXPIRIES: Array<{ days: number | null; label: string }> = [
  { days: null, label: "Never" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "A year" },
];

export function KeysSheet({ model, openPlayground }: { model: KeysModel; openPlayground: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expiry, setExpiry] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ raw: string; key: ApiKeyListItem } | null>(null);
  const [confirm, setConfirm] = useState<ApiKeyListItem | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const setSessionKey = useSessionKey((st) => st.setKey);

  const create = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Give the key a name you will recognise later.");
      return;
    }
    try {
      const res = await model.create({ name: name.trim(), scopes, expires_days: expiry });
      setMade(res);
      setOpen(false);
      setName("");
      setScopes(["read"]);
      setExpiry(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The key was not created");
    }
  };

  if (!model.loaded) return <Skeleton rows={5} />;

  if (!model.signedIn) {
    return (
      <div className={s.sheetInner}>
        <div className={s.hero}>
          <span className={s.heroTitle}>Keys</span>
          <span className={s.heroSub}>
            Keys belong to an account. Sign in to make one; the public routes need none, and the playground works without signing in.
          </span>
          <div className={s.linkRow} style={{ marginTop: 10 }}>
            <Link href="/sign-in?redirect_url=%2Fdeveloper%3Fview%3Dkeys" className={`${dk.btn} ${dk.btnPrimary}`}>
              Sign in
            </Link>
            <Link href="/developer?view=keys&demo" className={dk.btn}>
              See the demo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.sheetInner}>
      <header className={s.head}>
        <div className={s.headBody}>
          <span className={s.headTitle}>Keys</span>
          <span className={s.headSub}>
            A key is for calling the Analytics routes about your teams from your own code. Send it as <code>X-API-Key</code>. The full key is shown once, on creation; keep it somewhere safe.
          </span>
        </div>
        <div className={s.headActions}>
          <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={() => setOpen(true)}>
            <Plus size={13} /> New key
          </button>
        </div>
      </header>

      {made ? (
        <section className={s.block}>
          <div className={s.reveal}>
            <span className={s.inline} style={{ color: "var(--up)", fontWeight: 600 }}>
              <ShieldCheck size={14} /> {made.key.name} is ready. This is the only time the whole key is shown.
            </span>
            <div className={s.rawKey}>
              <span className={dk.grow}>{made.raw}</span>
              <CopyBtn text={made.raw} label="Copy key" />
            </div>
            <div className={s.row2}>
              <button
                type="button"
                className={`${dk.btn} ${dk.btnSmall}`}
                onClick={() => {
                  setSessionKey(made.raw);
                  openPlayground();
                }}
              >
                Use it in the playground
              </button>
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setMade(null)}>
                I have saved it
              </button>
              {model.demo ? <span className={dk.sub}>demo: this key opens nothing</span> : null}
            </div>
          </div>
        </section>
      ) : null}

      <Block title="Your keys" note={model.loading ? "loading…" : `${model.keys.length} active`}>
        {model.loading ? (
          <Skeleton rows={3} className={s.ledgerSkel} />
        ) : model.error ? (
          <div className={dk.error}>{model.error}</div>
        ) : revokeError ? (
          <div className={dk.error} style={{ marginBottom: 10 }}>
            {revokeError}
          </div>
        ) : null}
        {model.loading || model.error ? null : model.keys.length === 0 ? (
          <div className={s.blockEmpty}>No keys yet. Make one when you want to call the Analytics routes from your own code.</div>
        ) : (
          <div className={s.keyList}>
            {model.keys.map((k) => {
              const expired = isExpired(k);
              return (
                <div key={k.id} className={s.keyCard}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    <span className={s.inline}>
                      <KeyRound size={13} className={dk.chev} />
                      <span className={s.keyName}>{k.name}</span>
                      <span className={`${dk.mono} ${s.muted}`} style={{ fontSize: 12 }}>
                        {k.key_prefix}…
                      </span>
                    </span>
                    <span className={s.headChips}>
                      {k.scopes.map((sc) => (
                        <span key={sc} className={`${dk.chip} ${sc === "analytics" ? dk.pv : dk.flat}`}>
                          {sc}
                        </span>
                      ))}
                      <span className={`${dk.chip} ${dk.flat}`}>{k.rate_limit.toLocaleString("en-US")} / min</span>
                      {expired ? <span className={`${dk.chip} ${dk.down}`}>expired</span> : null}
                    </span>
                    <span className={s.keyMeta}>
                      <span>made {stamp(k.created_at)}</span>
                      <span>·</span>
                      <span>last used {ago(k.last_used_at)}</span>
                      <span>·</span>
                      <span>{k.expires_at ? `expires ${stamp(k.expires_at)}` : "never expires"}</span>
                    </span>
                  </div>
                  <div className={s.headActions}>
                    <button type="button" className={`${dk.btn} ${dk.btnSmall} ${dk.btnDanger}`} onClick={() => setConfirm(k)} disabled={model.revoking === k.id}>
                      {model.revoking === k.id ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Block>

      <Block title="What a key does" note="and what it does not">
        <div className={s.prose}>
          <ul>
            <li>
              Unlocks <code>POST /v1/analytics/generate-lineup</code> and <code>GET /v1/analytics/breakout-streamers</code> with the <code>analytics</code> scope, at 1,000 requests a minute.
            </li>
            <li>Does nothing for the public routes: they need no key and run at 100 a minute per address regardless.</li>
            <li>Is never shown again after creation. Lose it, revoke it, make another.</li>
            <li>Can expire on a day you choose; an expired or revoked key gets a 401.</li>
          </ul>
        </div>
      </Block>

      <DeskDialog
        open={open}
        onOpenChange={setOpen}
        title="New key"
        description="Name it for where it will live. Scopes decide which routes it opens."
        footer={
          <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={() => void create()} disabled={model.creating}>
            {model.creating ? "Creating…" : "Create key"}
          </button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className={s.field}>
            <span className={s.fieldLabel}>NAME</span>
            <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Lineup bot, notebook, …" autoFocus maxLength={100} />
          </label>
          <div className={s.field}>
            <span className={s.fieldLabel}>SCOPES</span>
            {SCOPES.map((sc) => (
              <label key={sc.id} className={s.check}>
                <input type="checkbox" checked={scopes.includes(sc.id)} onChange={(e) => setScopes((list) => (e.target.checked ? [...list, sc.id] : list.filter((x) => x !== sc.id)))} />
                <span>
                  <span className={dk.mono}>{sc.label}</span> <span className={s.muted}>— {sc.help}</span>
                </span>
              </label>
            ))}
          </div>
          <label className={s.field}>
            <span className={s.fieldLabel}>EXPIRES</span>
            <select className={s.select} value={expiry ?? ""} onChange={(e) => setExpiry(e.target.value === "" ? null : Number(e.target.value))}>
              {EXPIRIES.map((x) => (
                <option key={x.label} value={x.days ?? ""}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          {error ? <span className={dk.error}>{error}</span> : null}
        </div>
      </DeskDialog>

      <DeskDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `Revoke ${confirm.name}?` : "Revoke"}
        description="Anything using it stops working at once. This cannot be undone; make a new key instead."
        footer={
          <button
            type="button"
            className={`${dk.btn} ${dk.btnDanger}`}
            onClick={() => {
              if (confirm) {
                const id = confirm.id;
                setRevokeError(null);
                model.revoke(id).catch((e) => setRevokeError(`${confirm.name} was not revoked: ${e instanceof Error ? e.message : "the request failed"}`));
                // The reveal of a key just revoked has nothing left to say.
                if (made?.key.id === id) setMade(null);
              }
              setConfirm(null);
            }}
          >
            Revoke
          </button>
        }
      />
    </div>
  );
}
