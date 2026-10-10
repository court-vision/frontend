/**
 * The landing page's dot field: one set of particles that takes three shapes
 * in turn (a dribbled ball, a half court's lines, shots arcing into the rim)
 * and the geometry each shape is drawn from. Pure and seeded: the canvas
 * component owns time, the camera and drawing.
 *
 * Units are feet on a regulation half court. The floor is y = 0, x runs
 * sideline to sideline (-25..25) and z runs baseline (-23.5) to the
 * half-court line (23.5), so the scene's middle is the origin.
 */

export type Tone = 0 | 1 | 2;
/** Ink: lines and seams. Accent: the ball, the paint, the rim, made shots. Dim: dust. */
export const INK: Tone = 0;
export const ACCENT: Tone = 1;
export const DIM: Tone = 2;

export const BASELINE = -23.5;
export const HALF_LINE = 23.5;
export const HOOP = { x: 0, y: 10, z: BASELINE + 5.25 } as const;
export const BALL_RADIUS = 11.5;

export interface Arc {
  sx: number;
  sy: number;
  sz: number;
  ex: number;
  ey: number;
  ez: number;
  /** Height the arc rises above the straight line between its ends, at its middle. */
  k: number;
  /** Fraction of the arc travelled per second. */
  speed: number;
}

export interface Field {
  /** Particles that change shape. */
  n: number;
  /** Ball shape, relative to the ball's centre; spin and dribble are applied per frame. */
  ball: Float32Array;
  ballTone: Uint8Array;
  floor: Float32Array;
  floorTone: Uint8Array;
  /** Shots shape: a particle sits still at `shotStatic` unless `shotArc` names an arc. */
  shotStatic: Float32Array;
  shotArc: Int16Array;
  shotU: Float32Array;
  shotTone: Uint8Array;
  arcs: Arc[];
  /** Per particle: when it leaves in a morph (0..1) and how high it is tossed. */
  delay: Float32Array;
  lift: Float32Array;
  /** Where each particle floats before the ball first gathers: a loose cloud around it. */
  scatter: Float32Array;
  /** Dust that drifts through every shape. */
  m: number;
  ambient: Float32Array;
  ambientPhase: Float32Array;
}

/** mulberry32: a small seeded generator, so every visitor sees the same court. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number, number];

function shuffle<T>(xs: T[], rand: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/** A path on the court as a point at t in 0..1, with its length for spacing samples evenly. */
interface Path {
  len: number;
  at: (t: number) => Pt;
}

function segment(a: Pt, b: Pt): Path {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  return { len, at: (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] };
}

/** An arc on the floor around (cx, cz), from angle a0 to a1 (radians, measured from +x towards +z). */
function floorArc(cx: number, cz: number, r: number, a0: number, a1: number, y = 0): Path {
  return {
    len: Math.abs(a1 - a0) * r,
    at: (t) => {
      const a = a0 + (a1 - a0) * t;
      return [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
    },
  };
}

/** Spread `count` points along the paths by length, with a little jitter so the dots never line up like a grid. */
function sample(paths: Path[], count: number, rand: () => number): Pt[] {
  const total = paths.reduce((s, p) => s + p.len, 0);
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    let d = ((i + rand() * 0.6) / count) * total;
    let k = 0;
    while (k < paths.length - 1 && d > paths[k].len) d -= paths[k++].len;
    out.push(paths[k].at(Math.min(1, d / paths[k].len)));
  }
  return out;
}

/** The half court's painted lines. */
export function courtLines(): Path[] {
  const hx = HOOP.x;
  const hz = HOOP.z;
  const laneTop = BASELINE + 19;
  const corner = 22;
  const threeR = 23.75;
  const cornerEnd = hz + Math.sqrt(threeR * threeR - corner * corner);
  const a0 = Math.atan2(cornerEnd - hz, corner);
  return [
    segment([-25, 0, BASELINE], [25, 0, BASELINE]),
    segment([-25, 0, BASELINE], [-25, 0, HALF_LINE]),
    segment([25, 0, BASELINE], [25, 0, HALF_LINE]),
    segment([-25, 0, HALF_LINE], [25, 0, HALF_LINE]),
    // The lane and the free-throw circle.
    segment([-8, 0, BASELINE], [-8, 0, laneTop]),
    segment([8, 0, BASELINE], [8, 0, laneTop]),
    segment([-8, 0, laneTop], [8, 0, laneTop]),
    floorArc(0, laneTop, 6, 0, Math.PI * 2),
    // Restricted area.
    floorArc(hx, hz, 4, 0, Math.PI),
    // The three-point line: two corners and the arc.
    segment([-corner, 0, BASELINE], [-corner, 0, cornerEnd]),
    segment([corner, 0, BASELINE], [corner, 0, cornerEnd]),
    floorArc(hx, hz, threeR, a0, Math.PI - a0),
    // The half of the centre circle that is ours.
    floorArc(0, HALF_LINE, 6, Math.PI, Math.PI * 2),
  ];
}

/** Rim, net and the backboard's outline. */
function hoopPaths(): { rim: Path[]; net: Path[]; board: Path[] } {
  const { x, y, z } = HOOP;
  const net: Path[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    net.push(segment([x + 0.75 * Math.cos(a), y, z + 0.75 * Math.sin(a)], [x + 0.42 * Math.cos(a + 0.5), y - 1.6, z + 0.42 * Math.sin(a + 0.5)]));
  }
  const bz = BASELINE + 4;
  return {
    rim: [floorArc(x, z, 0.75, 0, Math.PI * 2, y)],
    net,
    board: [
      segment([-3, 9, bz], [3, 9, bz]),
      segment([3, 9, bz], [3, 12.5, bz]),
      segment([3, 12.5, bz], [-3, 12.5, bz]),
      segment([-3, 12.5, bz], [-3, 9, bz]),
      // The shooter's square.
      segment([-1, 10, bz], [1, 10, bz]),
      segment([1, 10, bz], [1, 11.5, bz]),
      segment([1, 11.5, bz], [-1, 11.5, bz]),
      segment([-1, 11.5, bz], [-1, 10, bz]),
    ],
  };
}

/** A point along a shot at u in 0..1: a straight line from release to rim, lifted by a parabola. */
export function arcPoint(a: Arc, u: number, out: Float32Array | number[], o = 0): void {
  const lift = 4 * a.k * u * (1 - u);
  out[o] = a.sx + (a.ex - a.sx) * u;
  out[o + 1] = a.sy + (a.ey - a.sy) * u + lift;
  out[o + 2] = a.sz + (a.ez - a.sz) * u;
}

/** Points on a sphere of radius r, evenly spread (a Fibonacci lattice). */
function sphere(count: number, r: number): Pt[] {
  const out: Pt[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    out.push([r * rad * Math.cos(th), r * y, r * rad * Math.sin(th)]);
  }
  return out;
}

/** A basketball's seams: two great circles and the two curved ones, as circles around the axis the great circles share. */
function seams(count: number, r: number, rand: () => number): Pt[] {
  const c = 0.62;
  const small = Math.sqrt(1 - c * c) * r;
  const paths: Path[] = [
    { len: 2 * Math.PI * r, at: (t) => [r * Math.cos(t * 2 * Math.PI), 0, r * Math.sin(t * 2 * Math.PI)] },
    { len: 2 * Math.PI * r, at: (t) => [r * Math.cos(t * 2 * Math.PI), r * Math.sin(t * 2 * Math.PI), 0] },
    { len: 2 * Math.PI * small, at: (t) => [c * r, small * Math.cos(t * 2 * Math.PI), small * Math.sin(t * 2 * Math.PI)] },
    { len: 2 * Math.PI * small, at: (t) => [-c * r, small * Math.cos(t * 2 * Math.PI), small * Math.sin(t * 2 * Math.PI)] },
  ];
  return sample(paths, count, rand);
}

function put(arr: Float32Array, i: number, p: Pt): void {
  arr[i * 3] = p[0];
  arr[i * 3 + 1] = p[1];
  arr[i * 3 + 2] = p[2];
}

/**
 * Build the field for n shape-changing particles and m dust particles.
 *
 * Index ranges keep each morph legible: the hoop is the hoop in both court
 * shapes, most lines stay put while shots rise out of the rest, and the
 * ball's seams come from the hoop and part of the lines.
 */
export function buildField(n: number, m: number, seed = 20261020): Field {
  const rand = rng(seed);
  const hoop = hoopPaths();

  const nRim = Math.round(n * 0.03);
  const nNet = Math.round(n * 0.02);
  const nBoard = Math.round(n * 0.03);
  const nHoop = nRim + nNet + nBoard;
  const nLines = Math.round(n * 0.62);
  const nKeep = Math.round(n * 0.4); // lines that stay lines when the shots go up
  const nPaint = Math.round(n * 0.18);
  const nCircle = Math.round(n * 0.04);
  const nDust = n - nHoop - nLines - nPaint - nCircle;

  const floor = new Float32Array(n * 3);
  const floorTone = new Uint8Array(n);
  const shotStatic = new Float32Array(n * 3);
  const shotArc = new Int16Array(n).fill(-1);
  const shotU = new Float32Array(n);
  const shotTone = new Uint8Array(n);

  // --- the floor
  const hoopPts: Array<[Pt, Tone]> = [
    ...sample(hoop.rim, nRim, rand).map((p): [Pt, Tone] => [p, ACCENT]),
    ...sample(hoop.net, nNet, rand).map((p): [Pt, Tone] => [p, INK]),
    ...sample(hoop.board, nBoard, rand).map((p): [Pt, Tone] => [p, INK]),
  ];
  const linePts = shuffle(sample(courtLines(), nLines, rand), rand);
  const paintPts: Pt[] = [];
  for (let i = 0; i < nPaint; i++) paintPts.push([-8 + rand() * 16, 0, BASELINE + rand() * 19]);
  const circlePts: Pt[] = [];
  for (let i = 0; i < nCircle; i++) {
    const a = Math.PI + rand() * Math.PI;
    const r = 6 * Math.sqrt(rand());
    circlePts.push([r * Math.cos(a), 0, HALF_LINE + r * Math.sin(a)]);
  }
  const dustPts: Pt[] = [];
  for (let i = 0; i < nDust; i++) dustPts.push([-25 + rand() * 50, 0, BASELINE + rand() * 47]);

  let i = 0;
  for (const [p, tone] of hoopPts) {
    put(floor, i, p);
    floorTone[i] = tone;
    put(shotStatic, i, p);
    shotTone[i] = tone;
    i++;
  }
  const lineStart = i;
  for (const p of linePts) {
    put(floor, i, p);
    floorTone[i] = INK;
    i++;
  }
  for (const p of paintPts) {
    put(floor, i, p);
    floorTone[i] = ACCENT;
    i++;
  }
  for (const p of circlePts) {
    put(floor, i, p);
    floorTone[i] = ACCENT;
    i++;
  }
  const dustStart = i;
  for (const p of dustPts) {
    put(floor, i, p);
    floorTone[i] = DIM;
    i++;
  }

  // --- the shots: lines stay, dust stays, everything else rises into arcs
  const arcs: Arc[] = [];
  const nArcs = 26;
  for (let a = 0; a < nArcs; a++) {
    const dist = 8 + Math.pow(rand(), 0.8) * 19;
    const ang = (rand() * 2 - 1) * 1.35;
    const sx = Math.max(-24, Math.min(24, dist * Math.sin(ang)));
    const sz = Math.min(21, HOOP.z + dist * Math.cos(ang));
    const sy = 7;
    const ey = HOOP.y + 0.3;
    // A shot peaks some 14 to 17 feet up, higher from further out.
    arcs.push({ sx, sy, sz, ex: HOOP.x, ey, ez: HOOP.z, k: 3.5 + dist * 0.2 + rand() * 2, speed: 0.2 + rand() * 0.1 });
  }
  const accentArc = arcs.map(() => rand() < 0.4);
  const risers: number[] = [];
  for (let k = lineStart; k < dustStart; k++) {
    if (k < lineStart + nKeep) {
      shotStatic.set(floor.subarray(k * 3, k * 3 + 3), k * 3);
      shotTone[k] = INK;
    } else {
      risers.push(k);
    }
  }
  risers.forEach((k, r) => {
    const a = r % nArcs;
    shotArc[k] = a;
    shotU[k] = (Math.floor(r / nArcs) / Math.ceil(risers.length / nArcs) + rand() * 0.012) % 1;
    shotTone[k] = accentArc[a] ? ACCENT : INK;
  });
  for (let k = dustStart; k < n; k++) {
    shotStatic.set(floor.subarray(k * 3, k * 3 + 3), k * 3);
    shotTone[k] = DIM;
  }

  // --- the ball: seams from the hoop and the first lines, the rest is leather
  const nSeam = Math.round(n * 0.22);
  const ball = new Float32Array(n * 3);
  const ballTone = new Uint8Array(n);
  const seamPts = shuffle(seams(nSeam, BALL_RADIUS * 1.01, rand), rand);
  const bodyPts = shuffle(sphere(n - nSeam, BALL_RADIUS), rand);
  for (let k = 0; k < n; k++) {
    if (k < nSeam) {
      put(ball, k, seamPts[k]);
      ballTone[k] = INK;
    } else {
      put(ball, k, bodyPts[k - nSeam]);
      ballTone[k] = ACCENT;
    }
  }

  const delay = new Float32Array(n);
  const lift = new Float32Array(n);
  const scatter = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    delay[k] = rand();
    lift[k] = 3 + rand() * 9;
    put(scatter, k, [-46 + rand() * 92, BALL_RADIUS - 15 + rand() * 36, -36 + rand() * 72]);
  }

  const ambient = new Float32Array(m * 3);
  const ambientPhase = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    put(ambient, k, [-60 + rand() * 120, rand() * 40, -55 + rand() * 110]);
    ambientPhase[k] = rand() * Math.PI * 2;
  }

  return { n, ball, ballTone, floor, floorTone, shotStatic, shotArc, shotU, shotTone, arcs, delay, lift, scatter, m, ambient, ambientPhase };
}
