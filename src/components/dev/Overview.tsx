"use client";

import { BookOpen, Database, ExternalLink, KeyRound, Play } from "lucide-react";
import { API_BASE } from "@/endpoints";
import type { HealthBody } from "@/lib/health";
import { curlFor } from "@/lib/openapi";
import { Block, Code, KV, uptime } from "./blocks";
import type { DevView } from "./views";
import dk from "@/components/desk/desk.module.css";
import s from "./dev.module.css";

interface OverviewProps {
  health: (HealthBody & { http: number; latencyMs: number }) | undefined;
  healthError: boolean;
  opCount: number | null;
  keyCount: number | null;
  signedIn: boolean;
  demo: boolean;
  go: (view: DevView) => void;
}

export function Overview({ health, healthError, opCount, keyCount, signedIn, demo, go }: OverviewProps) {
  const base = API_BASE.replace(/^https?:\/\//, "");
  const state = healthError ? "down" : !health ? "unknown" : health.status === "ok" ? "ok" : "degraded";
  const checks = health?.checks ?? {};
  const calendar = checks.calendar as (Record<string, unknown> & { ok?: boolean }) | undefined;
  return (
    <div className={s.sheetInner}>
      <div className={s.hero}>
        <span className={s.heroTitle}>Developer</span>
        <span className={s.heroSub}>
          Court Vision is a data product first. Everything the desks show comes from a public API with no key and no account, and the tables behind it can be queried directly. This desk is the reference, a place to try requests, your keys, and the query builder.
        </span>
        <div className={s.cards} style={{ marginTop: 12 }}>
          <button type="button" className={s.navCard} onClick={() => go("reference")}>
            <span className={s.navCardTitle}>
              <BookOpen size={14} className={dk.chev} /> Reference
            </span>
            <span className={s.navCardText}>{opCount ? `${opCount} public routes` : "Every public route"}, read from the live OpenAPI document, with the guides that go around them.</span>
          </button>
          <button type="button" className={s.navCard} onClick={() => go("playground")}>
            <span className={s.navCardTitle}>
              <Play size={14} className={dk.chev} /> Playground
            </span>
            <span className={s.navCardText}>Fill a route in and send it from here. Status, headers, body, and the cURL to take with you.</span>
          </button>
          <button type="button" className={s.navCard} onClick={() => go("keys")}>
            <span className={s.navCardTitle}>
              <KeyRound size={14} className={dk.chev} /> Keys
            </span>
            <span className={s.navCardText}>{signedIn && keyCount != null ? `${keyCount} active key${keyCount === 1 ? "" : "s"}.` : "Sign in to make keys."} Keys open the Analytics routes about your own teams.</span>
          </button>
          <button type="button" className={s.navCard} onClick={() => go("query")}>
            <span className={s.navCardTitle}>
              <Database size={14} className={dk.chev} /> Query
            </span>
            <span className={s.navCardText}>SQLMate: pick tables and columns, filter, order, run. Joins are resolved for you; results export or save.</span>
          </button>
        </div>
      </div>

      <div className={s.two}>
        <Block title="Status" note={health ? `checked just now · HTTP ${health.http}` : healthError ? "unreachable" : "checking…"}>
          <KV
            items={[
              { k: "API", v: state === "ok" ? "ok" : state === "degraded" ? "degraded" : state === "down" ? "unreachable" : "…", tone: state === "ok" ? "ok" : state === "degraded" ? "warn" : state === "down" ? "bad" : undefined },
              { k: "Version", v: health?.version ?? "—", title: "The deployed backend commit" },
              { k: "Environment", v: health?.environment ?? "—" },
              { k: "Up for", v: uptime(health?.uptime_s) },
              { k: "Round trip", v: health ? `${health.latencyMs} ms` : "—", title: "From this browser" },
              { k: "Database", v: checks.database ? (checks.database.ok ? `${checks.database.latency_ms ?? "?"} ms` : "failing") : "—", tone: checks.database ? (checks.database.ok ? "ok" : "bad") : undefined },
              { k: "Season", v: calendar && typeof calendar.season === "string" ? calendar.season : "—" },
              { k: "Weeks", v: calendar && typeof calendar.weeks === "number" ? String(calendar.weeks) : "—" },
            ]}
          />
        </Block>
        <Block title="Where" note="base URL and the documents">
          <KV items={[{ k: "Base", v: base }, { k: "Version prefix", v: "/v1" }, { k: "Format", v: "JSON envelope" }, { k: "Public limit", v: "100 / min" }]} />
          <div className={s.linkRow} style={{ marginTop: 12 }}>
            <a className={dk.btn} href={`${API_BASE}/openapi.json`} target="_blank" rel="noreferrer">
              openapi.json <ExternalLink size={11} />
            </a>
            <a className={dk.btn} href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">
              Swagger <ExternalLink size={11} />
            </a>
            <a className={dk.btn} href={`${API_BASE}/redoc`} target="_blank" rel="noreferrer">
              ReDoc <ExternalLink size={11} />
            </a>
            <a className={dk.btn} href="https://data.courtvision.dev" target="_blank" rel="noreferrer">
              Data platform <ExternalLink size={11} />
            </a>
          </div>
        </Block>
      </div>

      <Block title="First call" note="no key, no account">
        <Code text={curlFor(`${API_BASE}/v1/rankings/?window=14&min_games=3`, "GET", null, null)} lang="bash" />
        <div className={s.prose} style={{ marginTop: 10 }}>
          <p>
            Rankings over the last fourteen days, as the rankings page shows them. The answer is an envelope: <code>status</code>, <code>message</code>, <code>data</code>, and for rankings a <code>meta</code> block beside them with the season, the window and the scoring basis.
          </p>
        </div>
      </Block>

      <Block title="Limits" note="per address unless keyed">
        <table className={s.table}>
          <thead>
            <tr>
              <th>Routes</th>
              <th>Limit</th>
              <th>Counted by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={s.mono}>/v1/* public</td>
              <td className={s.mono}>100 / min</td>
              <td className={s.desc}>IP address</td>
            </tr>
            <tr>
              <td className={s.mono}>/v1/analytics/*</td>
              <td className={s.mono}>1,000 / min</td>
              <td className={s.desc}>API key, with the analytics scope</td>
            </tr>
            <tr>
              <td className={s.mono}>POST /v1/sqlmate/query</td>
              <td className={s.mono}>30 / min</td>
              <td className={s.desc}>IP address; the schema read is public</td>
            </tr>
          </tbody>
        </table>
        <div className={s.prose} style={{ marginTop: 10 }}>
          <p>
            Over the limit is a 429 with <code>error_code: RATE_LIMITED</code> and a <code>Retry-After</code> header. {demo ? "This is the demo: keys and query results here are samples." : ""}
          </p>
        </div>
      </Block>
    </div>
  );
}
