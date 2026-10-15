"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  barSpan,
  categoryX,
  chartTable,
  formatValue,
  leaders,
  linePath,
  linePoints,
  niceScale,
  position,
  shortCategory,
  sourcesOf,
  spreadLabels,
  xTickIndexes,
  type Plot,
} from "@/lib/ai-chart";
import type { AiChart, AiTable } from "@/types/ai";
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

/**
 * The blocks an answer carries between its prose: a table or a chart the
 * server built from the agent's lookups, never typed by the model (backend
 * services/ai/display.py). Both sit in one figure whose caption says where
 * the rows came from; a chart can also be read as a table, so every value it
 * draws is there in full.
 *
 * Charts follow the desk's rules for data marks: thin bars with a rounded
 * data end, 2px lines with 8px markers, hairline grid, the series' hue from
 * the theme's `--series-N` tokens and every word in text ink. Values are
 * written only where they help (the leading bar, the point under the
 * pointer, the readout under the plot), the table has them all.
 */

type Column = { key: string; label: string };

export function TableBlock({ table }: { table: AiTable }) {
  const cut = table.total_rows > table.rows.length ? `${table.rows.length} of ${table.total_rows}` : null;
  return (
    <BlockFigure title={table.title} from={sourcesOf(table.tools)} cut={cut}>
      <DataTable columns={table.columns} rows={table.rows} />
    </BlockFigure>
  );
}

export function ChartBlock({ chart }: { chart: AiChart }) {
  const [asTable, setAsTable] = useState(false);
  const cut = chart.total_rows > chart.categories.length ? `${chart.categories.length} of ${chart.total_rows}` : null;
  const twin = chartTable(chart);
  return (
    <BlockFigure
      title={chart.title}
      from={sourcesOf(chart.tools)}
      cut={cut}
      tools={
        <button type="button" className={s.blockToggle} aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Chart" : "Table"}
        </button>
      }
    >
      {asTable ? <DataTable columns={twin.columns} rows={twin.rows} /> : chart.kind === "bar" ? <Bars chart={chart} /> : <Lines chart={chart} />}
    </BlockFigure>
  );
}

function BlockFigure({ title, from, cut, tools, children }: { title: string; from: string; cut: string | null; tools?: ReactNode; children: ReactNode }) {
  return (
    <figure className={s.block} style={{ margin: 0 }}>
      <figcaption className={s.blockTitle}>
        <span>{title}</span>
        <span className={dk.sub} style={{ fontWeight: 400 }}>
          from {from}
          {cut ? ` · ${cut}` : ""}
        </span>
        {tools ? (
          <>
            <span className={dk.spacer} />
            {tools}
          </>
        ) : null}
      </figcaption>
      {children}
    </figure>
  );
}

// ---- tables

function DataTable({ columns, rows }: { columns: ReadonlyArray<Column>; rows: ReadonlyArray<ReadonlyArray<unknown>> }) {
  // A column is numeric when every value in it is a number (or empty)
  const numeric = columns.map((_, c) => rows.some((r) => typeof r[c] === "number") && rows.every((r) => r[c] == null || typeof r[c] === "number"));
  return (
    <div className={s.tableScroll}>
      <table className={s.table}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} className={numeric[i] ? s.num : undefined} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={numeric[i] ? s.num : undefined}>
                  {cell == null || cell === "" ? <span className={s.nil}>—</span> : formatCell(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(cell: unknown): string {
  if (typeof cell === "boolean") return cell ? "Yes" : "No";
  if (typeof cell === "number") return formatValue(cell);
  return String(cell);
}

// ---- charts

/** Horizontal bars, one row per category: names read best along the side, and a group of up to four thin bars fits a row. */
function Bars({ chart }: { chart: AiChart }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = chart.categories.length;
  const grouped = chart.series.length > 1;
  const scale = niceScale(chart.series.flatMap((sr) => sr.values));
  const zero = position(0, scale);
  const peak = leaders(chart.series);
  return (
    <>
      <div className={s.bars} data-grouped={grouped || undefined} onMouseLeave={() => setHover(null)}>
        <div className={s.barGrid} style={{ gridRow: `1 / span ${n}` }} aria-hidden>
          {scale.ticks.map((t) => (
            <span key={t} className={t === 0 ? s.zeroLine : s.gridLine} style={{ left: `${position(t, scale) * 100}%` }} />
          ))}
        </div>
        {chart.categories.map((c, i) => {
          const dim = hover != null && hover !== i;
          return (
            <Fragment key={i}>
              <span className={s.barLabel} style={{ gridRow: i + 1 }} title={c} onMouseEnter={() => setHover(i)}>
                {shortCategory(c)}
              </span>
              <div className={s.barTrack} style={{ gridRow: i + 1 }} data-dim={dim || undefined} onMouseEnter={() => setHover(i)}>
                {chart.series.map((sr, k) => {
                  const v = sr.values[i];
                  if (v == null) {
                    return (
                      <div key={sr.key} className={s.barLane}>
                        <span className={s.barGap} style={{ left: `${zero * 100}%` }}>
                          —
                        </span>
                      </div>
                    );
                  }
                  const span = barSpan(v, scale);
                  const negative = v < 0;
                  const labelled = peak[k] === i || hover === i;
                  return (
                    <div key={sr.key} className={s.barLane}>
                      {v !== 0 ? <div className={s.bar} data-series={k + 1} data-neg={negative || undefined} style={{ left: `${span.start * 100}%`, width: `${span.width * 100}%` }} /> : null}
                      {labelled ? (
                        <span className={s.barValue} data-neg={negative || undefined} style={negative ? { right: `${(1 - span.start) * 100}%` } : { left: `${(span.start + span.width) * 100}%` }}>
                          {formatValue(v)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Fragment>
          );
        })}
        <div className={s.barAxis} style={{ gridRow: n + 1 }} aria-hidden>
          {scale.ticks.map((t) => (
            <span key={t} style={{ left: `${position(t, scale) * 100}%` }}>
              {formatValue(t)}
            </span>
          ))}
        </div>
      </div>
      <Readout chart={chart} index={hover ?? 0} />
    </>
  );
}

const W = 640;
const H = 220;

/** A line per series over the categories in order, markers on each point while they fit, a crosshair under the pointer. */
function Lines({ chart }: { chart: AiChart }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = chart.categories.length;
  const multi = chart.series.length > 1;
  const scale = niceScale(chart.series.flatMap((sr) => sr.values));
  // Room on the right for each line's name at its end (two or more series only)
  const endRoom = multi ? Math.min(14, Math.max(...chart.series.map((sr) => sr.label.length))) * 6.5 + 14 : 10;
  const plot: Plot = { x: 46, y: 12, w: W - 46 - endRoom, h: H - 12 - 30 };
  const points = chart.series.map((sr) => linePoints(sr.values, scale, plot));
  const ends = points.map((pts) => [...pts].reverse().find((p) => p != null) ?? null);
  const endYs = spreadLabels(
    ends.map((p) => p?.y ?? plot.y + plot.h),
    12,
    plot.y + 5,
    plot.y + plot.h - 1
  );
  const slot = n > 1 ? plot.w / (n - 1) : plot.w;
  const markers = n <= 16;
  return (
    <>
      <svg className={s.lineChart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${chart.title}, as a line chart`} onMouseLeave={() => setHover(null)}>
        {scale.ticks.map((t) => {
          const y = plot.y + (1 - position(t, scale)) * plot.h;
          return (
            <g key={t}>
              <line className={t === 0 ? s.zeroHair : s.gridHair} x1={plot.x} x2={plot.x + plot.w} y1={y} y2={y} vectorEffect="non-scaling-stroke" />
              <text className={s.axisText} x={plot.x - 8} y={y + 3.5} textAnchor="end">
                {formatValue(t)}
              </text>
            </g>
          );
        })}
        {xTickIndexes(n).map((i) => (
          <text key={i} className={s.axisText} x={categoryX(i, n, plot)} y={H - 9} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
            {shortCategory(chart.categories[i])}
          </text>
        ))}
        {hover != null ? <line className={s.crosshair} x1={categoryX(hover, n, plot)} x2={categoryX(hover, n, plot)} y1={plot.y} y2={plot.y + plot.h} vectorEffect="non-scaling-stroke" /> : null}
        {points.map((pts, k) => (
          <g key={chart.series[k].key} data-series={k + 1}>
            <path className={s.linePath} d={linePath(pts)} vectorEffect="non-scaling-stroke" />
            {pts.map((p) => (p && (markers || p.i === hover) ? <circle key={p.i} className={s.marker} cx={p.x} cy={p.y} r={p.i === hover ? 5 : 4} vectorEffect="non-scaling-stroke" /> : null))}
            {multi && ends[k] ? (
              <text className={s.endLabel} x={plot.x + plot.w + 7} y={endYs[k] + 3.5}>
                {chart.series[k].label}
              </text>
            ) : null}
          </g>
        ))}
        {chart.categories.map((_, i) => (
          <rect key={i} className={s.hit} x={categoryX(i, n, plot) - slot / 2} y={plot.y} width={slot} height={plot.h} onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      <Readout chart={chart} index={hover ?? n - 1} />
    </>
  );
}

/** The values at one category, each beside its series' swatch: the legend and the hover reading in one line. */
function Readout({ chart, index }: { chart: AiChart; index: number }) {
  const c = chart.categories[index] ?? "";
  return (
    <div className={s.readout}>
      <span className={s.readoutX} title={c}>
        {shortCategory(c)}
      </span>
      {chart.series.map((sr, k) => (
        <span key={sr.key} className={s.readoutItem}>
          <i className={s.swatch} data-series={k + 1} aria-hidden />
          <span>{sr.label}</span>
          <span className={s.readoutValue}>{formatValue(sr.values[index])}</span>
        </span>
      ))}
    </div>
  );
}
