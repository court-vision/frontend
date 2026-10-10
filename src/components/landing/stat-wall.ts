import { rng } from "./court-field";

/**
 * The hero's backdrop: a wall of box-score lines in mono, printed so faintly it
 * reads as texture (a stat sheet seen through the court), not as data. Seeded,
 * so the server and the browser print the same sheet.
 */
const COLS: Array<[string, number]> = [
  ["MIN", 3],
  ["FG", 5],
  ["3PT", 5],
  ["FT", 5],
  ["REB", 3],
  ["AST", 3],
  ["STL", 3],
  ["BLK", 3],
  ["TO", 2],
  ["PTS", 3],
];
const SEP = "  ";
const GAP = "      ";

function row(cells: string[]): string {
  return cells.map((c, i) => c.padStart(COLS[i][1])).join(SEP);
}

function playerLine(rand: () => number): string {
  const min = 10 + Math.floor(rand() * 31);
  const fga = Math.max(1, Math.round(min * (0.25 + rand() * 0.3)));
  const fgm = Math.round(fga * (0.32 + rand() * 0.3));
  const tpa = Math.min(fga, Math.round(fga * rand() * 0.5));
  const tpm = Math.min(fgm, Math.round(tpa * (0.25 + rand() * 0.2)));
  const fta = Math.round(rand() * rand() * 12);
  const ftm = Math.round(fta * (0.6 + rand() * 0.35));
  const n = (max: number) => String(Math.floor(rand() * rand() * max));
  return row([
    String(min),
    `${fgm}-${fga}`,
    `${tpm}-${tpa}`,
    `${ftm}-${fta}`,
    n(16),
    n(12),
    n(4),
    n(4),
    n(5),
    String(fgm * 2 + tpm + ftm),
  ]);
}

export function statWall(lines = 44, cells = 6, seed = 1020): string {
  const rand = rng(seed);
  const header = row(COLS.map(([label]) => label));
  const out: string[] = [];
  for (let l = 0; l < lines; l++) {
    const parts: string[] = [];
    for (let c = 0; c < cells; c++) parts.push(l % 9 === 0 ? header : playerLine(rand));
    out.push(parts.join(GAP));
  }
  return out.join("\n");
}

export const STAT_WALL = statWall();

/**
 * Loose specks for the moment before the dot field draws, scattered (seeded)
 * round the middle of a 1440×900 hero (wide screens shift the layer over to
 * where the ball gathers): x, y, radius, accent.
 */
export function specks(count = 90, seed = 1021): Array<[number, number, number, boolean]> {
  const rand = rng(seed);
  const out: Array<[number, number, number, boolean]> = [];
  for (let i = 0; i < count; i++) {
    // Roughly normal around the ball, a sum of uniforms.
    const gx = (rand() + rand() + rand() - 1.5) / 1.5;
    const gy = (rand() + rand() + rand() - 1.5) / 1.5;
    out.push([720 + gx * 560, 360 + gy * 330, 0.8 + rand() * 1.1, rand() < 0.35]);
  }
  return out;
}

export const SPECKS = specks();
