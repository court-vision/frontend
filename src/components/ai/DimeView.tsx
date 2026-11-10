/**
 * One of Dime's views in the AI desk's main area (Check-ins, Memory, Move
 * results): a scrolling column with a line on what the view is, its controls
 * (a team switch, a scope) beside it, and the view below. The desk bar names it.
 */
import dk from "@/components/desk/desk.module.css";
import s from "./ai.module.css";

export function DimeView({
  label,
  sub,
  tools,
  children,
}: {
  label: string;
  sub: React.ReactNode;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={s.thread}>
      <section className={s.view} aria-label={label}>
        <header className={s.viewHead}>
          <p className={s.viewSub}>{sub}</p>
          {tools ? <div className={s.viewTools}>{tools}</div> : null}
        </header>
        {children}
      </section>
    </div>
  );
}

/** The view's skeleton while it loads. */
export function ViewLoading() {
  return (
    <div className={s.noteList} aria-busy>
      <span className={dk.skel} style={{ width: "70%" }} />
      <span className={dk.skel} style={{ width: "90%" }} />
      <span className={dk.skel} style={{ width: "50%" }} />
    </div>
  );
}
