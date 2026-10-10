import { describe, expect, test } from "bun:test";
import { arcPoint, BASELINE, buildField, HALF_LINE, HOOP } from "@/components/landing/court-field";

describe("landing court field", () => {
  const f = buildField(2000, 240);

  test("every shape places every particle, and nothing is NaN", () => {
    for (const arr of [f.ball, f.floor, f.shotStatic, f.ambient]) {
      expect(arr.every(Number.isFinite)).toBe(true);
    }
    expect(f.ball.length).toBe(f.n * 3);
    expect(f.floor.length).toBe(f.n * 3);
    expect(f.ambient.length).toBe(f.m * 3);
  });

  test("the floor's lines and paint lie on the half court; only the hoop stands above it", () => {
    let above = 0;
    for (let i = 0; i < f.n; i++) {
      const [x, y, z] = [f.floor[i * 3], f.floor[i * 3 + 1], f.floor[i * 3 + 2]];
      expect(Math.abs(x)).toBeLessThanOrEqual(25.001);
      expect(z).toBeGreaterThanOrEqual(BASELINE - 0.001);
      expect(z).toBeLessThanOrEqual(HALF_LINE + 0.001);
      if (y > 0) above++;
    }
    // Rim, net and backboard: 8% of the particles.
    expect(above / f.n).toBeCloseTo(0.08, 2);
  });

  test("shots start out on the floor side and end at the rim", () => {
    const p = [0, 0, 0];
    for (const arc of f.arcs) {
      arcPoint(arc, 1, p);
      expect(p[0]).toBeCloseTo(HOOP.x, 5);
      expect(p[2]).toBeCloseTo(HOOP.z, 5);
      arcPoint(arc, 0.5, p);
      expect(p[1]).toBeGreaterThan(HOOP.y); // a shot rises above the rim on the way
    }
    const risers = Array.from(f.shotArc).filter((a) => a >= 0).length;
    expect(risers / f.n).toBeGreaterThan(0.4);
  });

  test("the same seed builds the same court", () => {
    const again = buildField(2000, 240);
    expect(Array.from(again.floor.slice(0, 60))).toEqual(Array.from(f.floor.slice(0, 60)));
  });
});
