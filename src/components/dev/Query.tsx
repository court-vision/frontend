"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, Play, Plus, Save, Trash2, X } from "lucide-react";
import { DeskDialog } from "@/components/desk/DeskDialog";
import { downloadTableAsCSV } from "@/lib/csvUtils";
import {
  AGGREGATES,
  OPERATORS,
  OPERATOR_HELP,
  SORTS,
  addConstraint,
  addOrder,
  addTable,
  cellText,
  describe,
  groupSchema,
  isResultTable,
  isTextType,
  matchTables,
  moveOrder,
  removeConstraint,
  removeOrder,
  removeTable,
  selectAll,
  setAggregate,
  setAlias,
  setLimit,
  shortTable,
  toRequest,
  toggleColumn,
  toggleGroupBy,
  updateConstraint,
  updateOrder,
  validate,
  valuePlaceholder,
  type Canvas,
  type CanvasTable,
  type Operator,
  type Sort,
} from "@/lib/sqlmate-query";
import type { QueryResponse, SchemaTable, Table } from "@/types/sqlmate";
import { Block, Code, Skeleton, stamp } from "./blocks";
import type { QueryModel } from "./useDevModels";
import { useDevStore } from "./useDevStore";
import dk from "@/components/desk/desk.module.css";
import s from "./dev.module.css";

// ---------------------------------------------------------------------------
// Ledger: the schema, and your saved tables
// ---------------------------------------------------------------------------

export function QueryLedger({ model, canvas, add }: { model: QueryModel; canvas: Canvas; add: (t: SchemaTable) => void }) {
  const [q, setQ] = useState("");
  const [openTables, setOpenTables] = useState<Set<string>>(new Set());
  const groups = useMemo(() => groupSchema(matchTables(q, model.schema)), [q, model.schema]);
  const toggle = (t: string) =>
    setOpenTables((st) => {
      const next = new Set(st);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  return (
    <>
      <div className={s.ledgerHead}>
        <input className={s.filter} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tables and columns" aria-label="Filter the schema" />
        <span className={s.ledgerNote}>{model.schemaError ? "" : `${model.schema.length} tables SQLMate can read. Add one to the canvas; joins are found for you.`}</span>
      </div>
      <div className={s.rows}>
        {model.schemaLoading ? (
          <Skeleton rows={10} className={s.ledgerSkel} />
        ) : model.schemaError ? (
          <div className={s.ledgerEmpty}>
            <span className={dk.error}>{model.schemaError}</span>
            <div style={{ marginTop: 10 }}>
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={model.reloadSchema}>
                Try again
              </button>
            </div>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.schema}>
              <div className={s.group}>
                <span className={dk.label}>{g.schema || "saved"}</span>
                <span className={dk.sub}>{g.tables.length}</span>
              </div>
              {g.tables.map((t) => {
                const on = canvas.tables.some((c) => c.table === t.table);
                const open = openTables.has(t.table) || !!q.trim();
                return (
                  <div key={t.table}>
                    <div className={`${s.tableRow} ${on ? s.tableRowOn : ""}`} role="button" tabIndex={0} onClick={() => toggle(t.table)} onKeyDown={(e) => e.key === "Enter" && toggle(t.table)}>
                      {open ? <ChevronDown size={12} className={dk.chev} /> : <ChevronRight size={12} className={dk.chev} />}
                      <span className={s.tableName}>{shortTable(t.table)}</span>
                      <button
                        type="button"
                        className={s.addBtn}
                        disabled={on}
                        onClick={(e) => {
                          e.stopPropagation();
                          add(t);
                        }}
                        title={on ? "On the canvas" : "Add to the canvas"}
                      >
                        {on ? "ON" : <Plus size={11} />}
                      </button>
                    </div>
                    {open ? (
                      <div className={s.colList}>
                        {t.columns.map((c) => (
                          <div key={c.name} className={s.colRow}>
                            <span>{c.name}</span>
                            <span className={s.colType}>{c.type}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
        {model.signedIn ? (
          <div>
            <div className={s.group}>
              <span className={dk.label}>My tables</span>
              <span className={dk.sub}>{model.saved.length}</span>
            </div>
            {model.savedLoading ? (
              <div className={s.ledgerEmpty}>loading…</div>
            ) : model.saved.length === 0 ? (
              <div className={s.ledgerEmpty}>Results you save appear here, and can be queried again.</div>
            ) : (
              model.saved.map((t) => (
                <button key={t.table_name} type="button" className={`${s.row} ${s.rowPlain} ${model.savedOpen === t.table_name ? s.rowOn : ""}`} onClick={() => model.openSaved(model.savedOpen === t.table_name ? null : t.table_name)}>
                  <span>
                    <span className={s.tableName}>{t.table_name}</span>
                    <span className={s.rowSub}>saved {stamp(t.created_at)}</span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className={s.nodeToggle}
                    onClick={(e) => {
                      e.stopPropagation();
                      void model.remove([t.table_name]);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void model.remove([t.table_name])}
                    title="Delete this table"
                  >
                    <Trash2 size={11} />
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sheet: the canvas and the results
// ---------------------------------------------------------------------------

export function QuerySheet({ model, canvas, setCanvas }: { model: QueryModel; canvas: Canvas; setCanvas: (c: Canvas) => void }) {
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [ran, setRan] = useState<{ ms: number; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // A saved table opened from the ledger shows in the results.
  useEffect(() => {
    if (model.savedOpen && model.savedData) {
      setResult(model.savedData);
      setRan(null);
      setError(null);
    }
  }, [model.savedOpen, model.savedData]);

  const problem = validate(canvas);
  const run = async () => {
    if (problem || model.running) return;
    setError(null);
    model.openSaved(null);
    const t0 = performance.now();
    try {
      const res = await model.run(toRequest(canvas));
      setResult(res);
      setRan({ ms: Math.round(performance.now() - t0), at: Date.now() });
      if (res.status.status !== "success") setError(res.status.message ?? "The query failed");
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "The query failed");
    }
  };

  const table = result && isResultTable(result.table) ? result.table : null;
  const save = async () => {
    setSaveError(null);
    const name = saveName.trim().replace(/[^A-Za-z0-9_]/g, "_");
    if (!name) {
      setSaveError("Name the table.");
      return;
    }
    try {
      await model.save(name, table?.query ?? "");
      setSaveOpen(false);
      setSaveName("");
      setSavedFlash(name);
      setTimeout(() => setSavedFlash(null), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Not saved");
    }
  };

  return (
    <div
      className={s.sheetInner}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          void run();
        }
      }}
    >
      <div className={s.runBar}>
        <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={() => void run()} disabled={!!problem || model.running} title={problem ?? "Run (⌘⏎)"}>
          <Play size={13} />
          {model.running ? "Running…" : "Run"}
          <span className={dk.kbd}>⌘⏎</span>
        </button>
        <span className={s.runNote}>{problem ?? describe(canvas)}</span>
        <label className={s.inline} style={{ gap: 8 }}>
          <span className={dk.label}>Limit</span>
          <input className={`${s.input} ${s.inputSmall}`} style={{ width: 84 }} type="number" min={1} max={10000} value={canvas.limit} onChange={(e) => setCanvas(setLimit(canvas, Number(e.target.value)))} />
        </label>
        {canvas.tables.length ? (
          <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setCanvas({ ...canvas, tables: [], constraints: [], order: [] })}>
            Clear
          </button>
        ) : null}
        {model.demo ? <span className={`${dk.badge} ${dk.badgeDemo}`}>demo rows</span> : null}
      </div>

      <Block title="Canvas" note={canvas.tables.length ? `${canvas.tables.length} table${canvas.tables.length === 1 ? "" : "s"} · tick columns, name aliases, aggregate or group` : "add a table from the schema on the left"}>
        {canvas.tables.length === 0 ? (
          <div className={s.blockEmpty}>
            Add a table with the <span className={dk.mono}>+</span> beside its name. Several tables join themselves along their foreign keys: players to their stats, stats to their team.
          </div>
        ) : (
          <div className={s.canvas}>
            {canvas.tables.map((t) => (
              <TableCard key={t.table} t={t} canvas={canvas} setCanvas={setCanvas} />
            ))}
          </div>
        )}
      </Block>

      {canvas.tables.length ? (
        <div className={s.two}>
          <Block title="Filters" note={canvas.constraints.length ? `${canvas.constraints.length} · all must hold` : "none · use ⚡ on a column"}>
            {canvas.constraints.length === 0 ? (
              <div className={s.blockEmpty}>Every row comes back. Add a filter from a column&apos;s ⚡.</div>
            ) : (
              <div className={s.clauses}>
                {canvas.constraints.map((c) => {
                  const col = canvas.tables.find((t) => t.table === c.table)?.columns.find((x) => x.name === c.attribute);
                  return (
                    <div key={c.id} className={s.clause}>
                      <span className={s.clauseName} title={`${c.table}.${c.attribute}`}>
                        {shortTable(c.table)}.{c.attribute}
                      </span>
                      <select className={`${s.select} ${s.inputSmall}`} value={c.operator} onChange={(e) => setCanvas(updateConstraint(canvas, c.id, { operator: e.target.value as Operator }))} title={OPERATOR_HELP[c.operator]}>
                        {OPERATORS.filter((o) => isTextType(col?.type ?? "") || !["SUBSTRING", "PREFIX", "SUFFIX", "LIKE"].includes(o)).map((o) => (
                          <option key={o} value={o}>
                            {o} · {OPERATOR_HELP[o]}
                          </option>
                        ))}
                      </select>
                      <input className={`${s.input} ${s.inputSmall}`} value={c.value} onChange={(e) => setCanvas(updateConstraint(canvas, c.id, { value: e.target.value }))} placeholder={valuePlaceholder(col?.type ?? "", c.operator)} />
                      <button type="button" className={dk.iconBtn} style={{ width: 26, height: 26 }} onClick={() => setCanvas(removeConstraint(canvas, c.id))} aria-label="Remove filter">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Block>
          <Block title="Order" note={canvas.order.length ? "first wins" : "none · use ↕ on a column"}>
            {canvas.order.length === 0 ? (
              <div className={s.blockEmpty}>Rows come back as the database finds them. Add an order from a column&apos;s ↕.</div>
            ) : (
              <div className={s.clauses}>
                {canvas.order.map((o, i) => (
                  <div key={o.id} className={`${s.clause} ${s.clauseOrder}`}>
                    <span className={`${dk.sub}`}>{i + 1}</span>
                    <span className={s.clauseName}>
                      {shortTable(o.table)}.{o.attribute}
                    </span>
                    <select className={`${s.select} ${s.inputSmall}`} value={o.sort} onChange={(e) => setCanvas(updateOrder(canvas, o.id, { sort: e.target.value as Sort }))}>
                      {SORTS.map((x) => (
                        <option key={x} value={x}>
                          {x === "ASC" ? "ascending" : "descending"}
                        </option>
                      ))}
                    </select>
                    <span className={s.inline} style={{ gap: 2 }}>
                      <button type="button" className={s.tiny} onClick={() => setCanvas(moveOrder(canvas, o.id, -1))} disabled={i === 0} aria-label="Earlier">
                        <ArrowUp size={11} />
                      </button>
                      <button type="button" className={s.tiny} onClick={() => setCanvas(moveOrder(canvas, o.id, 1))} disabled={i === canvas.order.length - 1} aria-label="Later">
                        <ArrowDown size={11} />
                      </button>
                    </span>
                    <button type="button" className={dk.iconBtn} style={{ width: 26, height: 26 }} onClick={() => setCanvas(removeOrder(canvas, o.id))} aria-label="Remove order">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Block>
        </div>
      ) : null}

      <Block
        title={model.savedOpen ? `Saved · ${model.savedOpen}` : "Results"}
        note={table ? `${table.rows.length.toLocaleString("en-US")} row${table.rows.length === 1 ? "" : "s"} · ${table.columns.length} columns${ran ? ` · ${ran.ms} ms` : ""}${table.rows.length === canvas.limit && !model.savedOpen ? " · at the limit" : ""}` : model.savedDataLoading ? "loading…" : "nothing run yet"}
        right={
          table ? (
            <>
              <button type="button" className={`${dk.btn} ${dk.btnSmall} ${showSql ? dk.toggleOn : ""}`} onClick={() => setShowSql((v) => !v)}>
                SQL
              </button>
              <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => downloadTableAsCSV(table as Table, `${model.savedOpen ?? "query"}.csv`)}>
                <Download size={12} /> CSV
              </button>
              {model.signedIn && !model.savedOpen ? (
                <button type="button" className={`${dk.btn} ${dk.btnSmall}`} onClick={() => setSaveOpen(true)} disabled={model.saving}>
                  <Save size={12} /> {savedFlash ? `Saved ${savedFlash}` : "Save as table"}
                </button>
              ) : null}
            </>
          ) : null
        }
      >
        {error ? <div className={dk.error} style={{ marginBottom: 10 }}>{error}</div> : null}
        {table && showSql ? (
          <div style={{ marginBottom: 12 }}>
            <Code text={table.query} lang="sql" />
          </div>
        ) : null}
        {table ? (
          table.rows.length === 0 ? (
            <div className={s.blockEmpty}>No rows match.</div>
          ) : (
            <ResultGrid table={table} />
          )
        ) : model.savedDataLoading ? (
          <Skeleton rows={4} className={s.ledgerSkel} />
        ) : !error ? (
          <div className={s.blockEmpty}>Run the canvas to see rows here. The SQL that ran comes back with them.</div>
        ) : null}
      </Block>

      <DeskDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save as a table"
        description="The result becomes a table of yours (u_<you>_<name>) that the canvas can query and join like any other."
        footer={
          <button type="button" className={`${dk.btn} ${dk.btnPrimary}`} onClick={() => void save()} disabled={model.saving}>
            {model.saving ? "Saving…" : "Save"}
          </button>
        }
      >
        <label className={s.field}>
          <span className={s.fieldLabel}>NAME</span>
          <input className={s.input} value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="top_guards" autoFocus />
          {saveError ? <span className={dk.error}>{saveError}</span> : null}
        </label>
      </DeskDialog>
    </div>
  );
}

function TableCard({ t, canvas, setCanvas }: { t: CanvasTable; canvas: Canvas; setCanvas: (c: Canvas) => void }) {
  const picked = t.columns.filter((c) => c.selected).length;
  const all = picked === t.columns.length;
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <span className={s.cardSchema}>{t.table.includes(".") ? `${t.table.split(".")[0]}.` : ""}</span>
        <span style={{ fontWeight: 500 }}>{shortTable(t.table)}</span>
        <span className={dk.sub}>
          {picked}/{t.columns.length}
        </span>
        <span className={dk.spacer} />
        <button type="button" className={s.addBtn} onClick={() => setCanvas(selectAll(canvas, t.table, !all))}>
          {all ? "NONE" : "ALL"}
        </button>
        <button type="button" className={dk.iconBtn} style={{ width: 24, height: 24 }} onClick={() => setCanvas(removeTable(canvas, t.table))} aria-label="Remove table">
          <X size={12} />
        </button>
      </div>
      <div className={s.cardCols}>
        {t.columns.map((c) => (
          <div key={c.name}>
            <div className={`${s.colLine} ${c.selected ? s.colLineOn : ""}`}>
              <input type="checkbox" checked={c.selected} onChange={() => setCanvas(toggleColumn(canvas, t.table, c.name))} aria-label={`Select ${c.name}`} style={{ accentColor: "var(--accent)" }} />
              <span className={s.colName} onClick={() => setCanvas(toggleColumn(canvas, t.table, c.name))} title={c.name}>
                {c.name}
              </span>
              <span className={s.colType}>{c.type}</span>
              <button type="button" className={s.tiny} onClick={() => setCanvas(addConstraint(canvas, t.table, c.name, isTextType(c.type) ? "=" : ">="))} title="Filter on this column">
                ⚡
              </button>
              <button type="button" className={`${s.tiny} ${canvas.order.some((o) => o.table === t.table && o.attribute === c.name) ? s.tinyOn : ""}`} onClick={() => setCanvas(addOrder(canvas, t.table, c.name, isTextType(c.type) ? "ASC" : "DESC"))} title="Order by this column">
                ↕
              </button>
            </div>
            {c.selected ? (
              <div className={s.colExtra}>
                <input className={`${s.input} ${s.inputSmall}`} value={c.alias} onChange={(e) => setCanvas(setAlias(canvas, t.table, c.name, e.target.value))} placeholder="alias" aria-label={`Alias for ${c.name}`} />
                <select className={`${s.select} ${s.inputSmall}`} value={c.aggregate} onChange={(e) => setCanvas(setAggregate(canvas, t.table, c.name, e.target.value as typeof c.aggregate))} aria-label={`Aggregate ${c.name}`}>
                  <option value="">as is</option>
                  {AGGREGATES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <button type="button" className={`${s.addBtn} ${c.groupBy ? s.tinyOn : ""}`} onClick={() => setCanvas(toggleGroupBy(canvas, t.table, c.name))} title="Group rows by this column">
                  GROUP
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultGrid({ table }: { table: Table }) {
  const numeric = useMemo(() => table.columns.map((_, i) => table.rows.slice(0, 50).every((r) => r[i] == null || typeof r[i] === "number")), [table]);
  const rows = table.rows.slice(0, 2000);
  return (
    <div className={s.results}>
      <table className={s.grid}>
        <thead>
          <tr>
            <th className={s.rowIdx}>#</th>
            {table.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={s.rowIdx}>{i + 1}</td>
              {r.map((v: unknown, j: number) => (
                <td key={j} className={numeric[j] ? s.num : ""} title={cellText(v)}>
                  {cellText(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > rows.length ? <div className={s.ledgerEmpty}>Showing the first {rows.length.toLocaleString("en-US")} of {table.rows.length.toLocaleString("en-US")} rows; the CSV has them all.</div> : null}
    </div>
  );
}

/** The canvas lives in the persisted store so a page reload keeps it. */
export function useCanvas(): [Canvas, (c: Canvas) => void, (t: SchemaTable) => void] {
  const canvas = useDevStore((st) => st.canvas);
  const setCanvas = useDevStore((st) => st.setCanvas);
  return [canvas, setCanvas, (t) => setCanvas(addTable(canvas, t))];
}
