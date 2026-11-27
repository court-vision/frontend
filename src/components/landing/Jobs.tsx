import s from "./landing.module.css";

/**
 * What runs on its own: the jobs a team's automation table holds (Account →
 * AI and automation; lib/ai-autonomy.ts), each with the levels it offers, then
 * autopilot, which puts them all at AI. Off isn't drawn: it is what the
 * account's own settings start from.
 */
const LEVELS = ["Notify", "Act", "AI"] as const;
type Level = (typeof LEVELS)[number];

const JOBS: Array<{ name: string; what: string; levels: Level[] }> = [
  {
    name: "Lineup",
    what: "Fills each day's lineup before the first tip, so everyone with a game starts.",
    levels: ["Notify", "Act", "AI"],
  },
  {
    name: "Daily actions",
    what: "Moves an out player to IR when a seat is open, and fills open roster spots with the day's best free agents. Never a drop.",
    levels: ["Act", "AI"],
  },
  {
    name: "Stream lanes",
    what: "Keeps a roster spot streaming: it switches to the free agent with the next games, on the plan you set.",
    levels: ["Act", "AI"],
  },
  {
    name: "Late scratches",
    what: "A starter ruled out before his game: an email with the swap it calls for, or the swap made.",
    levels: ["Notify", "Act", "AI"],
  },
];

const LEGEND: Record<Level, string> = {
  Notify: "an email says what is due",
  Act: "Court Vision does it, no AI",
  AI: "Dime does it and logs the call",
};

export function Jobs() {
  return (
    <section className={s.jobs} aria-labelledby="jobs-title">
      <div className={s.desksHead}>
        <h2 id="jobs-title" className={s.h2}>
          Set it once.
        </h2>
        <p className={s.intro}>
          Each team has its own table of jobs, and each job runs at the level you pick, every day, whether or not you open
          the app.
        </p>
      </div>

      <table className={s.jobTable}>
        <thead>
          <tr>
            <th scope="col">
              <span className={s.srOnly}>Job</span>
            </th>
            {LEVELS.map((l) => (
              <th key={l} scope="col" className={s.jobLevel}>
                <span className={s.jobLevelName} data-ai={l === "AI" ? "" : undefined}>
                  {l}
                </span>
                <span className={s.jobLevelNote}>{LEGEND[l]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {JOBS.map((j) => (
            <tr key={j.name}>
              <th scope="row" className={s.jobName}>
                <span>{j.name}</span>
                <span className={s.jobWhat}>{j.what}</span>
              </th>
              {LEVELS.map((l) => (
                <td key={l} className={s.jobCell} data-level={l}>
                  {j.levels.includes(l) ? (
                    <span className={s.jobOn} data-ai={l === "AI" ? "" : undefined} aria-label={`${l}: offered`} />
                  ) : (
                    <span className={s.jobOff} aria-label={`${l}: not offered`} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={s.jobNotes}>
        <p>
          <span className={s.jobNoteHead}>
            Autopilot <span className={s.tabBadge}>Beta</span>
          </span>
          One switch puts every job at AI. Dime reviews the plan, makes the moves within your league&apos;s limits and your
          locks, and logs each call for you to agree or disagree with.
        </p>
        <p>
          <span className={s.jobNoteHead}>Locked players</span>
          Lock a player on the Week desk and nothing that runs for you will drop him, or suggest it.
        </p>
      </div>
    </section>
  );
}
