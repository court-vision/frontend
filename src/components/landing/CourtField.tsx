"use client";

import { useEffect, useRef } from "react";
import { useDeskTheme } from "@/components/desk/useDeskTheme";
import { themeScheme } from "@/components/desk/themes";
import { arcPoint, BALL_RADIUS, buildField, type Field } from "./court-field";

/**
 * The landing's moving picture: a field of dots that dribbles as a ball,
 * drops into a half court's lines, then sends shots arcing into the rim, and
 * round again. It opens with the dots floating loose, then swirling together
 * into the ball, which settles before it starts to dribble. Drawn in the desk
 * theme's own ink and accent: printed dots on the light themes, lit ones on
 * the dark. A click moves it to the next shape; the pointer leans the camera.
 * Still (one frame of the shots) when the visitor prefers reduced motion.
 */

const BALL = 0;
const FLOOR = 1;
const SHOTS = 2;
/** Seconds each shape holds before it turns into the next. */
const HOLD = [3.4, 3.6, 5.8];
const MORPH = 2.4;
/** The opening: seconds the dots float loose, then seconds they take to gather into the ball. */
const FLOAT = 1.1;
const GATHER = 2.6;
const INTRO = FLOAT + GATHER;

/**
 * Per shape: how high the camera looks down, how far back it sits, the point
 * it looks at, and where across a wide screen that point lands (clear of the
 * headline in the bottom left).
 */
interface Cam {
  pitch: number;
  dist: number;
  y: number;
  z: number;
  across: number;
}
const CAMS: Cam[] = [
  { pitch: 0.12, dist: 60, y: 15.5, z: 0, across: 0.57 },
  { pitch: 0.8, dist: 86, y: 0, z: 8, across: 0.63 },
  { pitch: 0.4, dist: 78, y: 6, z: 9, across: 0.65 },
];

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

function hexRgb(value: string): [number, number, number] {
  const h = value.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Opacity steps per tone: dots are drawn in one path per (tone, step). */
const STEPS = 6;

export function CourtField({ className, onLive }: { className?: string; onLive?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useDeskTheme((s) => s.theme);
  const paint = useRef<{ colors: string[][]; lit: boolean }>({ colors: [], lit: false });
  const redraw = useRef<() => void>(() => {});
  const live = useRef(onLive);
  live.current = onLive;

  // The theme's ink, accent and quiet text, at each opacity step.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const tones = ["--text", "--accent", "--text-3"].map((v) => hexRgb(cs.getPropertyValue(v)));
    paint.current = {
      lit: themeScheme(theme) === "dark",
      colors: tones.map(([r, g, b]) => Array.from({ length: STEPS }, (_, s) => `rgba(${r},${g},${b},${((s + 1) / STEPS).toFixed(3)})`)),
    };
    redraw.current();
  }, [theme]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let field: Field = buildField(10, 0);
    // Per-dot screen position, radius and bucket, reused every frame.
    let sx = new Float32Array(0);
    let sy = new Float32Array(0);
    let sr = new Float32Array(0);
    let sb = new Int16Array(0);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = w < 640 ? 1500 : w < 1100 ? 2200 : 2800;
      if (n !== field.n) {
        field = buildField(n, Math.round(n * 0.12));
        const total = field.n + field.m;
        sx = new Float32Array(total);
        sy = new Float32Array(total);
        sr = new Float32Array(total);
        sb = new Int16Array(total);
      }
    };

    // Clock: seconds of animation, paused while off screen or hidden.
    let clock = still ? 1.6 : 0;
    let phase = still ? SHOTS : BALL;
    let phaseStart = still ? 0 : INTRO;
    let pointerX = 0;
    let pointerY = 0;
    let leanX = 0;
    let leanY = 0;

    const pos = new Float32Array(3);
    const a3 = new Float32Array(3);
    const b3 = new Float32Array(3);

    /** Where particle i sits in a shape at time t; returns an opacity factor for shots fading in and out at their ends. */
    const shapeAt = (shape: number, i: number, t: number, out: Float32Array, spin: number[], ballY: number, squash: number): number => {
      const f = field;
      if (shape === BALL) {
        const x = f.ball[i * 3];
        const y = f.ball[i * 3 + 1];
        const z = f.ball[i * 3 + 2];
        out[0] = (spin[0] * x + spin[1] * y + spin[2] * z) / Math.sqrt(squash);
        out[1] = (spin[3] * x + spin[4] * y + spin[5] * z) * squash + ballY;
        out[2] = (spin[6] * x + spin[7] * y + spin[8] * z) / Math.sqrt(squash);
        return 1;
      }
      if (shape === FLOOR) {
        out[0] = f.floor[i * 3];
        out[1] = f.floor[i * 3 + 1];
        out[2] = f.floor[i * 3 + 2];
        return 1;
      }
      const a = f.shotArc[i];
      if (a < 0) {
        out[0] = f.shotStatic[i * 3];
        out[1] = f.shotStatic[i * 3 + 1];
        out[2] = f.shotStatic[i * 3 + 2];
        return 1;
      }
      const arc = f.arcs[a];
      const u = (f.shotU[i] + t * arc.speed) % 1;
      arcPoint(arc, u, out);
      return clamp(u / 0.06, 0, 1) * clamp((1 - u) / 0.05, 0, 1);
    };

    const toneOf = (shape: number, i: number) =>
      shape === BALL ? field.ballTone[i] : shape === FLOOR ? field.floorTone[i] : field.shotTone[i];

    const frame = () => {
      const { colors, lit } = paint.current;
      if (!colors.length || !w) return;
      const t = clock;
      const f = field;

      // The opening: floating (G = 0), then gathering into the ball (G 0 → 1).
      const intro = !still && t < INTRO;
      const G = intro ? clamp((t - FLOAT) / GATHER, 0, 1) : 1;
      const introFade = intro ? clamp(t / 0.9, 0, 1) : 1;

      // Which shape, or which two and how far between.
      let local = t - phaseStart;
      while (!still && local > HOLD[phase] + MORPH) {
        phaseStart += HOLD[phase] + MORPH;
        local -= HOLD[phase] + MORPH;
        phase = (phase + 1) % 3;
      }
      const morphing = !still && local > HOLD[phase];
      const T = morphing ? (local - HOLD[phase]) / MORPH : 0;
      const next = (phase + 1) % 3;
      const camT = ease(clamp(T * 1.15 - 0.1, 0, 1));

      // The dribble: a bounce every 0.7 s, squashed for an instant at the floor.
      // It starts once the ball has gathered, from the floor.
      const bounce = Math.abs(Math.sin((Math.PI * (still ? t : Math.max(0, t - INTRO))) / 0.7));
      const squash = bounce < 0.12 ? 0.9 + (bounce / 0.12) * 0.1 : 1;
      const ballY = BALL_RADIUS * 0.98 + 6 * bounce;
      // Spin about a tilted axis (Rodrigues).
      const ang = t * 2.2;
      const ax = 0.94;
      const ay = 0.33;
      const az = 0.0;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const C = 1 - c;
      const spin = [
        c + ax * ax * C, ax * ay * C - az * s, ax * az * C + ay * s,
        ay * ax * C + az * s, c + ay * ay * C, ay * az * C - ax * s,
        az * ax * C - ay * s, az * ay * C + ax * s, c + az * az * C,
      ];

      // Camera: orbit the scene's middle, leaning with the pointer.
      leanX += (pointerX - leanX) * 0.04;
      leanY += (pointerY - leanY) * 0.04;
      const c0 = CAMS[phase];
      const c1 = CAMS[next];
      const pitch = c0.pitch + (c1.pitch - c0.pitch) * camT + leanY * 0.08;
      const dist = c0.dist + (c1.dist - c0.dist) * camT;
      const ty = c0.y + (c1.y - c0.y) * camT;
      const tz = c0.z + (c1.z - c0.z) * camT;
      const yaw = 0.42 + 0.22 * Math.sin(t * 0.07) + leanX * 0.3;
      const cpx = dist * Math.sin(yaw) * Math.cos(pitch);
      const cpy = ty + dist * Math.sin(pitch);
      const cpz = tz + dist * Math.cos(yaw) * Math.cos(pitch);
      // Basis: forward towards (0, ty, tz), right (forward × world up), up (right × forward).
      let fx = -cpx;
      let fy = ty - cpy;
      let fz = tz - cpz;
      const fl = Math.hypot(fx, fy, fz);
      fx /= fl;
      fy /= fl;
      fz /= fl;
      let rx = -fz;
      let rz = fx;
      const rl = Math.hypot(rx, rz);
      rx /= rl;
      rz /= rl;
      const ux = -rz * fy;
      const uy = rz * fx - rx * fz;
      const uz = rx * fy;

      const wide = w > 900;
      const cx = w * (wide ? c0.across + (c1.across - c0.across) * camT : 0.5);
      const cy = h * (wide ? 0.47 : 0.38);
      // Fit the court across the width (a phone lets it run a little past the
      // edges) and the ball within the height, whichever is smaller.
      const F = Math.min(((wide ? 0.8 : 1.08) * w * 64) / 50, (0.6 * h * 58) / 23);

      const total = f.n + f.m;
      for (let i = 0; i < total; i++) {
        let tone: number;
        let fade = 1;
        let size = 1;
        if (i < f.n) {
          if (intro) {
            // Loose and drifting, then swirled in round the ball's axis as it gathers.
            shapeAt(BALL, i, t, b3, spin, ballY, squash);
            const ph = f.delay[i] * 6.283;
            const lx = f.scatter[i * 3] + Math.sin(t * 0.35 + ph) * 2.2;
            const ly = f.scatter[i * 3 + 1] + Math.sin(t * 0.29 + ph * 1.7) * 1.6;
            const lz = f.scatter[i * 3 + 2] + Math.cos(t * 0.31 + ph) * 2.2;
            const p = ease(clamp((G - f.delay[i] * 0.45) / 0.55, 0, 1));
            const turn = (1 - p) * 2.4;
            const ct = Math.cos(turn);
            const st = Math.sin(turn);
            const sx0 = lx * ct - lz * st;
            const sz0 = lx * st + lz * ct;
            pos[0] = sx0 + (b3[0] - sx0) * p;
            pos[1] = ly + (b3[1] - ly) * p;
            pos[2] = sz0 + (b3[2] - sz0) * p;
            fade = introFade * (0.6 + 0.4 * p);
            // Loose dots are quiet; they take the ball's colours as they arrive.
            tone = p > 0.55 ? f.ballTone[i] : f.ballTone[i] === 1 ? 2 : 0;
          } else if (morphing) {
            const fa = shapeAt(phase, i, t, a3, spin, ballY, squash);
            const fb = shapeAt(next, i, t, b3, spin, ballY, squash);
            const p = ease(clamp((T - f.delay[i] * 0.35) / 0.65, 0, 1));
            const dx = b3[0] - a3[0];
            const dy = b3[1] - a3[1];
            const dz = b3[2] - a3[2];
            const far = Math.min(1, Math.hypot(dx, dy, dz) / 10);
            pos[0] = a3[0] + dx * p;
            pos[1] = a3[1] + dy * p + Math.sin(Math.PI * p) * f.lift[i] * far;
            pos[2] = a3[2] + dz * p;
            fade = fa + (fb - fa) * p;
            tone = toneOf(p < 0.5 ? phase : next, i);
          } else {
            fade = shapeAt(phase, i, t, pos, spin, ballY, squash);
            tone = toneOf(phase, i);
          }
          size = tone === 2 ? 0.65 : 1;
        } else {
          const k = i - f.n;
          const ph = f.ambientPhase[k];
          pos[0] = f.ambient[k * 3] + Math.sin(t * 0.13 + ph) * 1.6;
          pos[1] = f.ambient[k * 3 + 1] + Math.sin(t * 0.11 + ph * 1.3) * 1.2;
          pos[2] = f.ambient[k * 3 + 2] + Math.cos(t * 0.09 + ph) * 1.6;
          tone = 2;
          size = 0.5;
          fade = introFade;
        }

        const dx = pos[0] - cpx;
        const dy = pos[1] - cpy;
        const dz = pos[2] - cpz;
        const zv = dx * fx + dy * fy + dz * fz;
        // Dust right in front of the lens would be a blur, not a speck: let it go.
        if (i >= f.n) fade *= clamp((zv - 22) / 18, 0, 1);
        if (zv < 4 || fade <= 0.02) {
          sb[i] = -1;
          continue;
        }
        const xv = dx * rx + dz * rz;
        const yv = dx * ux + dy * uy + dz * uz;
        sx[i] = cx + (xv * F) / zv;
        sy[i] = cy - (yv * F) / zv;
        sr[i] = clamp(((0.085 * F) / zv) * size * (0.85 + ((i * 7919) % 100) / 250), 0.55, i < f.n ? 3.6 : 1.6);
        const depth = clamp(1.4 - zv / (dist * 1.35), 0.3, 1);
        const base = tone === 2 ? 0.42 : tone === 1 ? 0.95 : 0.88;
        const step = clamp(Math.round(base * depth * fade * STEPS) - 1, 0, STEPS - 1);
        sb[i] = tone * STEPS + step;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = lit ? "lighter" : "source-over";
      for (let bucket = 0; bucket < 3 * STEPS; bucket++) {
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < total; i++) {
          if (sb[i] !== bucket) continue;
          const r = sr[i];
          ctx.moveTo(sx[i] + r, sy[i]);
          ctx.arc(sx[i], sy[i], r, 0, Math.PI * 2);
          any = true;
        }
        if (!any) continue;
        ctx.fillStyle = colors[Math.floor(bucket / STEPS)][bucket % STEPS];
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    redraw.current = frame;

    let raf = 0;
    let last = 0;
    let visible = true;
    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      clock += dt;
      frame();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (still || raf || !visible) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(() => {
      resize();
      frame();
    });
    ro.observe(canvas);
    resize();
    frame();
    live.current?.();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointerX = e.clientX / window.innerWidth - 0.5;
      pointerY = e.clientY / window.innerHeight - 0.5;
    };
    // A click moves on to the next shape.
    const onClick = () => {
      if (still || clock < INTRO) return;
      const local = clock - phaseStart;
      if (local < HOLD[phase]) phaseStart = clock - HOLD[phase];
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    canvas.addEventListener("click", onClick);
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
      redraw.current = () => {};
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
