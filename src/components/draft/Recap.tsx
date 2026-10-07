"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { DeskBar, DeskStatus } from "@/components/desk/DeskBar";
import { Headshot } from "@/components/desk/Headshot";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import dk from "@/components/desk/desk.module.css";
import {
  asOfLabel,
  formatGradedTotal,
  gradedLabel,
  gradedPickValue,
  gradedTotal,
  gradeTone,
  pickColumnsFor,
  pickNaturalDirection,
  pickSourceGlyph,
  positionLabel,
  rankTone,
  recapCaveats,
  resolvePick,
  sortPicks,
  sortSeats,
  sortStandings,
  standingsMode,
  type PickColumn,
} from "@/lib/draft-recap";
import type { DraftRecapResult, PickSortKey, RecapPick, RecapSeat, SortDirection } from "@/types/draft";
import { num, ordinal, shortName, signed } from "./format";
import { roomFacts, roomTitle } from "./RoomView";
import { recapExit, type RecapModel } from "./model";
import s from "./draft.module.css";

const PICK_WIDTH: Partial<Record<PickSortKey, string>> = {
  overall_pick: "52px",
  round: "40px",
  slot: "64px",
  player_name: "minmax(220px, 1fr)",
  team: "52px",
};

export function RecapView({ model }: { model: RecapModel }) {
  const router = useRouter();
  const toggleTheme = useDeskTheme((st) => st.toggle);
  const exit = recapExit(model.session?.kind, model.hrefs);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [role='dialog']")) return;
      if (e.key === "Escape" || e.key === "r") router.push(exit.href);
      if (e.key === "t") toggleTheme();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, exit.href, toggleTheme]);

  const session = model.session;
  return (
    <>
      <DeskBar desk="draft" demo={model.demo} onRefresh={model.demo ? undefined : model.refetch}>
        {session ? (
          <>
            <span style={{ fontWeight: 600 }}>{roomTitle(session)}</span>
            <span className={dk.sub}>recap · {roomFacts(session)}</span>
          </>
        ) : null}
      </DeskBar>
      {model.status !== "ready" || !session ? (
        model.status === "loading" ? (
          <div className={dk.desk} aria-busy>
            <div className={s.ticker} />
          </div>
        ) : (
          <div className={dk.empty}>
            <span className={dk.emptyTitle}>{model.status === "signed-out" ? "Sign in to read this recap" : "This recap could not be opened"}</span>
            <span>{model.message}</span>
            <Link href={model.hrefs.lobby} className={dk.btn}>
              All rooms
            </Link>
          </div>
        )
      ) : !model.recap ? (
        <div className={dk.desk} aria-busy>
          <div className={s.ticker} />
        </div>
      ) : model.recap.picks.length === 0 ? (
        <div className={dk.empty}>
          <span className={dk.emptyTitle}>Nothing to recap yet</span>
          <span>{model.recap.message || "Draft first, then read the recap."}</span>
          {session.kind !== "import" ? (
            <Link href={model.hrefs.room} className={dk.btn}>
              Back to the room
            </Link>
          ) : null}
        </div>
      ) : (
        <RecapBody recap={model.recap} roomHref={session.kind === "import" ? null : model.hrefs.room} />
      )}
      <DeskStatus keys={[["R", exit.label], ["T", "theme"]]}>
        {model.recap ? <span>{asOfLabel(model.recap.meta)}</span> : null}
      </DeskStatus>
    </>
  );
}

function RecapBody({ recap, roomHref }: { recap: DraftRecapResult; roomHref: string | null }) {
  const meta = recap.meta;
  const gradedBy = meta?.graded_by ?? null;
  const seats = useMemo(() => sortSeats(recap.seats), [recap.seats]);
  const me = seats.find((x) => x.is_me) ?? null;
  const [seatFilter, setSeatFilter] = useState<number | null>(null);
  const caveats = recapCaveats(meta, recap.seats.length);
  const mode = standingsMode(meta, recap.standings);
  const myStanding = me ? recap.standings.find((x) => x.slot === me.slot) ?? null : null;
  const best = me ? resolvePick(recap.picks, me.best_pick) : null;
  const worst = me ? resolvePick(recap.picks, me.worst_pick) : null;
  const positions = seats.map((x) => x.position);
  const label = gradedLabel(gradedBy);

  return (
    <>
      <div className={s.ticker}>
        {me ? (
          <>
            <div className={s.tick}>
              <span className={dk.label}>Your grade</span>
              <span className={s.tickValue}>
                <span className={s.grade} data-tone={gradeTone(me.grade)} style={{ width: 40, height: 30, fontSize: 16 }}>
                  {me.grade ?? "—"}
                </span>
                <span className={s.tickSub}>
                  {positionLabel(me.position, positions)} of {recap.seats.length}
                </span>
              </span>
            </div>
            <div className={s.tick} title={label.title}>
              <span className={dk.label}>{label.short}</span>
              <span className={s.tickValue}>{formatGradedTotal(gradedTotal(me, gradedBy), gradedBy)}</span>
            </div>
            {best ? <PickTick label="Best pick" pick={best} gradedBy={gradedBy} /> : null}
            {worst && worst.overall_pick !== best?.overall_pick ? <PickTick label="Reach" pick={worst} gradedBy={gradedBy} /> : null}
            {myStanding ? (
              <div className={s.tick}>
                <span className={dk.label}>Projected</span>
                <span className={s.tickValue}>
                  {mode === "categories" ? (myStanding.roto_rank != null ? ordinal(Math.round(myStanding.roto_rank)) : "—") : myStanding.value_rank != null ? ordinal(Math.round(myStanding.value_rank)) : "—"}
                  <span className={s.tickSub}>
                    {mode === "categories"
                      ? myStanding.expected_wins != null
                        ? `roto · ${myStanding.expected_wins.toFixed(1)} cats a week`
                        : "roto"
                      : `${Math.round(myStanding.season_value ?? 0).toLocaleString("en-US")} season pts`}
                  </span>
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className={s.tick}>
            <span className={dk.label}>Recap</span>
            <span className={s.tickValue}>
              {recap.picks.length} picks <span className={s.tickSub}>no seat of yours set — every seat graded</span>
            </span>
          </div>
        )}
        <div className={s.tickActions}>
          {roomHref ? (
            <Link href={roomHref} className={dk.btn}>
              Back to the room <span className={dk.kbd}>R</span>
            </Link>
          ) : null}
        </div>
      </div>
      {caveats.length ? (
        <div className={s.caveats}>
          {caveats.map((c) => (
            <span key={c.key} className={c.tone === "warn" ? s.caveatWarn : undefined}>
              {c.text}
            </span>
          ))}
        </div>
      ) : null}
      <div className={s.recap}>
        <aside className={s.recapSide}>
          <div className={s.sectionHead}>
            <span className={dk.label}>Seats</span>
            <span className={s.right}>
              <span className={dk.sub} title={label.title}>
                {label.short}
              </span>
            </span>
          </div>
          {seats.map((seat) => (
            <SeatRow
              key={seat.slot}
              seat={seat}
              picks={recap.picks}
              gradedBy={gradedBy}
              positions={positions}
              selected={seatFilter === seat.slot}
              onSelect={() => setSeatFilter((x) => (x === seat.slot ? null : seat.slot))}
            />
          ))}
        </aside>
        <div className={s.recapMain}>
          <PickTable recap={recap} seatFilter={seatFilter} onClearFilter={() => setSeatFilter(null)} />
          {mode !== "none" ? <Standings recap={recap} mode={mode} /> : null}
        </div>
      </div>
    </>
  );
}

function PickTick({ label, pick, gradedBy }: { label: string; pick: RecapPick; gradedBy: Parameters<typeof gradedPickValue>[1] }) {
  const v = gradedPickValue(pick, gradedBy);
  return (
    <div className={s.tick}>
      <span className={dk.label}>{label}</span>
      <span className={s.tickValue} style={{ fontSize: 15, alignItems: "center" }}>
        <Headshot nbaId={pick.player_id} name={pick.player_name ?? "?"} size={24} />
        <span style={{ fontFamily: "var(--desk-sans)" }}>{shortName(pick.player_name ?? "—")}</span>
        <span className={s.tickSub}>
          #{pick.overall_pick} · <span style={{ color: v == null ? undefined : v >= 0 ? "var(--up)" : "var(--down)" }}>{signed(v)}</span>
        </span>
      </span>
    </div>
  );
}

function SeatRow({
  seat,
  picks,
  gradedBy,
  positions,
  selected,
  onSelect,
}: {
  seat: RecapSeat;
  picks: RecapPick[];
  gradedBy: Parameters<typeof gradedTotal>[1];
  positions: Array<number | null | undefined>;
  selected: boolean;
  onSelect: () => void;
}) {
  const best = resolvePick(picks, seat.best_pick);
  return (
    <button type="button" className={s.seatRow} aria-pressed={selected} data-me={seat.is_me} onClick={onSelect} title={selected ? "Show every pick" : "Show only this seat's picks"}>
      <span className={dk.sub}>{positionLabel(seat.position, positions)}</span>
      <span className={s.grade} data-tone={gradeTone(seat.grade)}>
        {seat.grade ?? "—"}
      </span>
      <span style={{ minWidth: 0 }}>
        <div className={s.seatLabel}>{seat.is_me ? `You · seat ${seat.slot}` : `Seat ${seat.slot}`}</div>
        <div className={s.seatSub}>
          {seat.picks} picks{best ? ` · best ${shortName(best.player_name ?? "?")}` : ""}
        </div>
      </span>
      <span className={s.mono} style={{ fontSize: 12.5 }}>
        {formatGradedTotal(gradedTotal(seat, gradedBy), gradedBy)}
      </span>
    </button>
  );
}

function widthOf(c: PickColumn): string {
  return PICK_WIDTH[c.key] ?? "60px";
}

function PickTable({ recap, seatFilter, onClearFilter }: { recap: DraftRecapResult; seatFilter: number | null; onClearFilter: () => void }) {
  const columns = useMemo(() => pickColumnsFor(recap.meta), [recap.meta]);
  // A provenance mark only says something when the picks came from more than one place.
  const mixed = useMemo(() => new Set(recap.picks.map((p) => p.source)).size > 1, [recap.picks]);
  const [sort, setSort] = useState<{ key: PickSortKey; dir: SortDirection }>({ key: "overall_pick", dir: "asc" });
  const rows = useMemo(() => {
    const filtered = seatFilter == null ? recap.picks : recap.picks.filter((p) => p.slot === seatFilter);
    return sortPicks(filtered, sort.key, sort.dir);
  }, [recap.picks, seatFilter, sort]);
  const template = columns.map(widthOf).join(" ");
  const gradedBy = recap.meta?.graded_by ?? null;
  const toggle = (key: PickSortKey) => setSort((x) => (x.key === key ? { key, dir: x.dir === "asc" ? "desc" : "asc" } : { key, dir: pickNaturalDirection(key) }));
  return (
    <section>
      <div className={s.panelHead}>
        <span className={dk.label}>Every pick, priced</span>
        <span className={dk.sub}>{seatFilter == null ? `${recap.picks.length} picks` : `seat ${seatFilter} · ${rows.length} picks`}</span>
        {seatFilter != null ? (
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={onClearFilter}>
            Show all
          </button>
        ) : null}
      </div>
      <div className={s.table}>
        <div className={s.tableHead} style={{ gridTemplateColumns: template }}>
          {columns.map((c) => (
            <button key={c.key} type="button" className={s.th} data-align={c.align} data-sorted={sort.key === c.key} title={c.title} onClick={() => toggle(c.key)}>
              {c.label}
              {sort.key === c.key ? sort.dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} /> : null}
            </button>
          ))}
        </div>
        {rows.map((p) => (
          <div key={p.overall_pick} className={s.tableRow} style={{ gridTemplateColumns: template }} data-me={p.by_me}>
            {columns.map((c) => (
              <PickCell key={c.key} column={c} pick={p} graded={gradedPickValue(p, gradedBy)} marks={mixed} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function PickCell({ column, pick, graded, marks }: { column: PickColumn; pick: RecapPick; graded: number | null; marks: boolean }) {
  const td = (content: React.ReactNode, color?: string, title?: string) => (
    <span className={s.td} data-align={column.align} style={color ? { color } : undefined} title={title}>
      {content}
    </span>
  );
  const tone = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.05 ? undefined : v > 0 ? "var(--up)" : "var(--down)");
  switch (column.key) {
    case "overall_pick":
      return td(pick.overall_pick, "var(--text-3)");
    case "round":
      return td(pick.round ?? "—", "var(--text-3)");
    case "slot":
      return td(pick.by_me ? "You" : pick.slot ?? "—", pick.by_me ? "var(--accent)" : undefined);
    case "player_name": {
      const glyph = marks ? pickSourceGlyph(pick.source) : null;
      return (
        <span className={s.player}>
          <Headshot nbaId={pick.player_id} name={pick.player_name ?? "?"} size={22} />
          <span className={s.playerName} style={{ fontSize: 12.5 }}>
            {pick.player_name ?? "—"}
          </span>
          {glyph ? (
            <span className={s.tag} title={glyph.title}>
              {glyph.glyph}
            </span>
          ) : null}
        </span>
      );
    }
    case "team":
      return td(pick.team ?? "—");
    case "value":
      return td(num(pick.value), "var(--text)");
    case "cv_rank":
      return td(pick.cv_rank ?? "—");
    case "market_rank":
      return td(pick.market_rank ?? "—");
    case "adp":
      return td(num(pick.adp));
    case "market_value":
      return td(pick.market_value != null ? `$${pick.market_value.toFixed(0)}` : "—");
    case "bid":
      return td(pick.bid != null ? `$${pick.bid.toFixed(0)}` : "—");
    case "surplus_cv":
      return td(signed(pick.surplus_cv, 0), tone(pick.surplus_cv));
    case "surplus_espn":
      return td(signed(pick.surplus_espn, 0), tone(pick.surplus_espn));
    case "surplus_market":
      return td(signed(pick.surplus_market, 0), tone(pick.surplus_market));
    case "value_over_slot":
      return td(signed(pick.value_over_slot), tone(pick.value_over_slot));
    case "market_value_over_slot":
      return td(signed(pick.market_value_over_slot), tone(pick.market_value_over_slot), graded != null ? "What this pick was graded on" : undefined);
    case "market_value_over_bid":
      return td(signed(pick.market_value_over_bid), tone(pick.market_value_over_bid));
    default:
      return td("—");
  }
}

function Standings({ recap, mode }: { recap: DraftRecapResult; mode: "categories" | "points" }) {
  const standings = sortStandings(recap.standings, mode);
  const seats = recap.seats.length;
  const mySlot = recap.seats.find((x) => x.is_me)?.slot ?? null;
  if (mode === "points") {
    const max = Math.max(1, ...standings.map((x) => x.season_value ?? 0));
    return (
      <section>
        <div className={s.panelHead} style={{ borderTop: "1px solid var(--line)" }}>
          <span className={dk.label}>Projected season</span>
          <span className={dk.sub}>Σ value × projected games, each roster as drafted</span>
        </div>
        <div className={s.bars}>
          {standings.map((x) => (
            <div key={x.slot} className={s.barRow} data-me={x.slot === mySlot}>
              <span className={dk.sub} style={x.slot === mySlot ? { color: "var(--accent)" } : undefined}>
                {x.value_rank != null ? ordinal(Math.round(x.value_rank)) : "—"} · {x.slot === mySlot ? "You" : `S${x.slot}`}
              </span>
              <span className={s.barTrack}>
                <span className={s.barFill} style={{ display: "block", width: `${((x.season_value ?? 0) / max) * 100}%` }} />
              </span>
              <span className={s.mono} style={{ textAlign: "right", fontSize: 12 }}>
                {Math.round(x.season_value ?? 0).toLocaleString("en-US")}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }
  const cats = recap.meta?.categories ?? [];
  const template = `96px repeat(${cats.length}, 54px) 64px 64px`;
  const tint = (rank: number) => {
    const t = rankTone(rank, seats);
    return t === "high" ? "color-mix(in srgb, var(--up) 16%, transparent)" : t === "low" ? "color-mix(in srgb, var(--down) 14%, transparent)" : "var(--surface-2)";
  };
  return (
    <section>
      <div className={s.panelHead} style={{ borderTop: "1px solid var(--line)" }}>
        <span className={dk.label}>Projected standings</span>
        <span className={dk.sub}>rank in each category among {seats} rosters, as drafted · summed z, not a simulation</span>
      </div>
      <div className={s.table}>
        <div className={s.tableHead} style={{ gridTemplateColumns: template }}>
          <span className={s.th}>Seat</span>
          {cats.map((c) => (
            <span key={c.key} className={s.th} data-align="center">
              {c.label}
            </span>
          ))}
          <span className={s.th} data-align="right" title="Roto points: one per team beaten in each category">
            Roto
          </span>
          <span className={s.th} data-align="right" title="Categories won in an average weekly matchup; a tie counts half">
            Cats/wk
          </span>
        </div>
        {standings.map((x) => (
          <div key={x.slot} className={s.tableRow} style={{ gridTemplateColumns: template, height: 32 }} data-me={x.slot === mySlot}>
            <span className={s.td} style={x.slot === mySlot ? { color: "var(--accent)" } : undefined}>
              {x.roto_rank != null ? `${ordinal(Math.round(x.roto_rank))} · ` : ""}
              {x.slot === mySlot ? "You" : `S${x.slot}`}
            </span>
            {cats.map((c) => {
              const line = x.categories.find((l) => l.key === c.key);
              return (
                <span key={c.key} className={s.heatCell} style={{ background: line ? tint(line.rank) : undefined }} title={line ? `z ${line.z_sum.toFixed(2)}` : undefined}>
                  {line ? ordinal(Math.round(line.rank)) : "—"}
                </span>
              );
            })}
            <span className={s.td} data-align="right">
              {x.roto_points != null ? x.roto_points.toFixed(0) : "—"}
            </span>
            <span className={s.td} data-align="right">
              {x.expected_wins != null ? x.expected_wins.toFixed(1) : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
