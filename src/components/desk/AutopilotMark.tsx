import Link from "next/link";
import { ACCOUNT_DESK } from "./routes";
import dk from "./desk.module.css";


/**
 * The bar's mark while Dime Autopilot runs the team in view: the word in the
 * spectrum, inside an outline that runs with it. It is the way to the switch,
 * so a desk shows it only for a team whose autopilot is live (ai-autonomy's
 * `autopilotLive`), never for one that is merely switched on over a pause.
 * In a demo the link stays in the demo.
 */
export function AutopilotMark({ team, demo = false }: { team?: string | null; demo?: boolean }) {
  const where = team ? ` on ${team}` : "";
  return (
    <Link
      href={`${ACCOUNT_DESK}?${demo ? "demo&" : ""}v=automation`}
      className={`${dk.badge} ${dk.autopilotMark}`}
      title={`Dime Autopilot is running${where}: every automation is at AI. Open its switch in Account.`}
      aria-label={`Dime Autopilot is on${where}. Open its settings`}
    >
      <span className={dk.spectrumText}>Autopilot</span>
    </Link>
  );
}
