"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Headshot } from "@/components/desk/Headshot";
import { apiClient } from "@/lib/api";
import { playerKeys } from "@/hooks/usePlayer";
import { LINE_COLS, bestOf, fmtStat, lineFromAvg, windowLabel, type Focus, type StatLine, type Window } from "@/lib/scout";
import type { PlayerStats } from "@/types/player";
import type { RankingsPlayer } from "@/types/rankings";
import { Block } from "./blocks";
import dk from "@/components/desk/desk.module.css";
import s from "./scout.module.css";

export interface CompareSheetProps {
  ids: number[];
  window: Window;
  poolById: Map<number, RankingsPlayer>;
  open: (focus: Focus) => void;
  unpin: (focus: Focus) => void;
  close: () => void;
}

interface Row {
  key: string;
  label: string;
  values: Array<number | null>;
  better: "high" | "low";
  digits: number;
  fmt?: (v: number | null) => string;
}

/** The pinned players side by side; the best number in each row is lit. */
export function CompareSheet({ ids, window, poolById, open, unpin, close }: CompareSheetProps) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: playerKeys.stats(id, "nba", window),
      queryFn: () => apiClient.getPlayerStats(id, "nba", window),
      staleTime: 1000 * 60 * 5,
    })),
  });
  const players = results.map((r) => r.data ?? null) as Array<PlayerStats | null>;
  const lines = useMemo(() => players.map((p) => (p ? lineFromAvg(p.avg_stats, p.window_games) : null)), [players]);

  const rows: Row[] = useMemo(() => {
    const line = (k: keyof StatLine): Array<number | null> => lines.map((l) => (l ? (l[k] as number | null) : null));
    const adv = (k: keyof NonNullable<PlayerStats["advanced_stats"]>): Array<number | null> => players.map((p) => p?.advanced_stats?.[k] ?? null);
    return [
      { key: "rank", label: "Rank", values: ids.map((id) => poolById.get(id)?.rank ?? null), better: "low", digits: 0, fmt: (v) => (v == null ? "—" : `#${v}`) },
      { key: "gp", label: "GP", values: line("gp"), better: "high", digits: 0 },
      ...LINE_COLS.map((c) => ({ key: c.key, label: c.label, values: line(c.key), better: c.better, digits: c.digits })),
      { key: "ts", label: "TS%", values: players.map((p) => p?.avg_stats.avg_ts_pct ?? null), better: "high", digits: 1 },
      { key: "usg", label: "USG%", values: adv("usg_pct"), better: "high", digits: 1 },
      { key: "pie", label: "PIE", values: adv("pie"), better: "high", digits: 1 },
      { key: "net", label: "Net rtg", values: adv("net_rating"), better: "high", digits: 1 },
    ];
  }, [ids, lines, players, poolById]);

  return (
    <div className={s.sheetInner}>
      <header className={s.head} style={{ alignItems: "center" }}>
        <div className={s.headBody}>
          <div className={s.headName}>
            <span>Compare</span>
            <span className={dk.sub}>
              {ids.length} players · {windowLabel(window)} · best in each row lit
            </span>
          </div>
        </div>
        <div className={s.headActions}>
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={close}>
            <X size={12} /> Close
            <span className={dk.kbd}>esc</span>
          </button>
        </div>
      </header>
      <Block title="Side by side" note="per game for the window · season for the ratings">
        <div className={s.tableWrap}>
          <table className={`${s.table} ${s.compareTable}`}>
            <thead>
              <tr>
                <th />
                {ids.map((id, i) => {
                  const p = players[i];
                  const name = p?.name ?? poolById.get(id)?.player_name ?? `Player ${id}`;
                  return (
                    <th key={id} style={{ position: "static" }}>
                      <div className={s.compareHead}>
                        <button type="button" className={s.linkBtn} onClick={() => open({ kind: "player", id })} title="Open">
                          <Headshot nbaId={id} name={name} size={40} />
                        </button>
                        <span className={s.compareName}>{name}</span>
                        <span className={dk.sub} style={{ textTransform: "none", letterSpacing: 0 }}>
                          {p?.team ?? poolById.get(id)?.team ?? ""}
                          {poolById.get(id)?.position ? ` · ${poolById.get(id)?.position}` : ""}
                        </span>
                        <button type="button" className={s.benchX} onClick={() => unpin({ kind: "player", id })} aria-label={`Unpin ${name}`}>
                          <X size={11} />
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const best = bestOf(r.values, r.better);
                return (
                  <tr key={r.key}>
                    <td className={s.text} style={{ color: "var(--text-2)" }}>
                      {r.label}
                    </td>
                    {r.values.map((v, i) => (
                      <td key={ids[i]} className={best.has(i) && best.size < r.values.length ? s.best : v == null ? s.muted : s.strong}>
                        {r.fmt ? r.fmt(v) : fmtStat(v, r.digits)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Block>
    </div>
  );
}
