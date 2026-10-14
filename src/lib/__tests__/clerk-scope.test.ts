import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * Clerk ships only where it is used. The landing, /privacy, the 404 and the
 * error pages render outside (desk)/layout.tsx, the one ClerkProvider, so
 * nothing they import may reach @clerk: it would put clerk-js back on pages
 * that never use it (~350 KB br), and a Clerk hook there would throw for want
 * of its provider. This walks their imports the way the bundler would.
 */
const SRC = resolve(import.meta.dir, "../..");

const OUTSIDE_CLERK = [
  "app/layout.tsx",
  "app/page.tsx",
  "app/not-found.tsx",
  "app/error.tsx",
  "app/global-error.tsx",
  "app/privacy/page.tsx",
];

// Value imports and re-exports, multi-line ones included; `import type` ships nothing.
const IMPORT = /(?:^|\n)\s*(?:import(?!\s+type\b)[^'"]*?from\s*|import\s*|export(?!\s+type\b)[^'"]*?from\s*)["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (base === null) return null;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx"), base]) {
    if (/\.(tsx?|mjs|js)$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every module an entry pulls in, each with the packages it imports. */
function graph(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  const queue = [join(SRC, entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    const packages: string[] = [];
    seen.set(file, packages);
    for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
      const spec = m[1] ?? m[2];
      if (spec.endsWith(".css")) continue;
      const local = resolveLocal(file, spec);
      if (local) queue.push(local);
      else if (!spec.startsWith(".") && !spec.startsWith("@/")) packages.push(spec);
    }
  }
  return seen;
}

describe("Clerk's reach", () => {
  test("the pages outside the desks import nothing from @clerk, however deep", () => {
    for (const entry of OUTSIDE_CLERK) {
      const clerk = [...graph(entry)].filter(([, pkgs]) => pkgs.some((p) => p.startsWith("@clerk/"))).map(([f]) => relative(SRC, f));
      expect({ entry, clerk }).toEqual({ entry, clerk: [] });
    }
  });

  test("the walk does find Clerk where it is used", () => {
    const desk = [...graph("app/(desk)/week/page.tsx")].filter(([, pkgs]) => pkgs.some((p) => p.startsWith("@clerk/")));
    expect(desk.length).toBeGreaterThan(0);
    expect([...graph("app/(desk)/layout.tsx").values()].flat()).toContain("@clerk/nextjs");
    expect([...graph("app/(desk)/sign-in/[[...sign-in]]/page.tsx").values()].flat()).toContain("@clerk/nextjs");
  });

  test("the landing's walk covers what it renders", () => {
    const files = [...graph("app/page.tsx").keys()].map((f) => relative(SRC, f));
    expect(files).toContain("components/landing/Landing.tsx");
    expect(files).toContain("components/desk/ThemePicker.tsx");
    expect(files).toContain("components/desk/DeskFrame.tsx");
  });
});
