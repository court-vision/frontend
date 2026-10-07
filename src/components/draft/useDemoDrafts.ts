"use client";

import { useEffect, useReducer, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  demoAdvance,
  demoBoard,
  demoPick,
  newDemoRoom,
  type DemoFixture,
  type DemoFormat,
  type DemoRoom,
} from "@/lib/draft-demo";

// ---------------------------------------------------------------------------
// The pool: a real board snapshot, loaded only when a demo needs it
// ---------------------------------------------------------------------------

const loaded: Partial<Record<DemoFormat, DemoFixture>> = {};

async function loadFixture(format: DemoFormat): Promise<DemoFixture> {
  const cached = loaded[format];
  if (cached) return cached;
  const mod =
    format === "points"
      ? await import("@/__fixtures__/draft-demo/points.json")
      : await import("@/__fixtures__/draft-demo/categories.json");
  const fixture = mod.default as unknown as DemoFixture;
  loaded[format] = fixture;
  return fixture;
}

export function useDemoFixtures(): Record<DemoFormat, DemoFixture | null> {
  const [fixtures, setFixtures] = useState<Record<DemoFormat, DemoFixture | null>>({
    points: loaded.points ?? null,
    categories: loaded.categories ?? null,
  });
  useEffect(() => {
    let live = true;
    void Promise.all([loadFixture("points"), loadFixture("categories")]).then(([points, categories]) => {
      if (live) setFixtures({ points, categories });
    });
    return () => {
      live = false;
    };
  }, []);
  return fixtures;
}

// ---------------------------------------------------------------------------
// The rooms: kept for the browser session
// ---------------------------------------------------------------------------

interface DemoDraftState {
  rooms: DemoRoom[];
  seeded: boolean;
  nextId: number;
  seed: (points: DemoFixture) => void;
  create: (opts: Parameters<typeof newDemoRoom>[1]) => DemoRoom;
  put: (room: DemoRoom) => void;
  remove: (id: number) => void;
  reset: () => void;
}

const MINUTE = 60_000;

/** Three rooms to open on: a draft in progress, a fresh 9-cat room, a finished one. */
function seedRooms(points: DemoFixture, now: number): DemoRoom[] {
  let live = newDemoRoom(-1, { format: "points", size: 10, rounds: 13, mySlot: 4, name: "Paint Beasts mock" }, now - 20 * MINUTE);
  for (let i = 0; i < 2; i++) {
    live = demoAdvance(live, points, "my_turn", now - 20 * MINUTE).room;
    const call = demoBoard(live, points, "espn").recommendations[0];
    live = demoPick(live, points, { player_id: call.player_id, by_me: true, source: "manual" }, now - 20 * MINUTE).room;
  }
  live = demoAdvance(live, points, "my_turn", now - 3 * MINUTE).room;
  const cats = newDemoRoom(-2, { format: "categories", size: 12, rounds: 13, mySlot: 7, name: "9-cat rehearsal" }, now - 2 * MINUTE);
  let done = newDemoRoom(-3, { format: "points", size: 10, rounds: 13, mySlot: 2, name: "Points dry run" }, now - 2 * 24 * 60 * MINUTE);
  done = demoAdvance(done, points, "end", now - 2 * 24 * 60 * MINUTE + 40 * MINUTE).room;
  return [live, cats, done];
}

export const useDemoDrafts = create<DemoDraftState>()(
  persist(
    (set, get) => ({
      rooms: [],
      seeded: false,
      nextId: 4,
      seed: (points) => {
        if (get().seeded) return;
        set({ rooms: seedRooms(points, Date.now()), seeded: true, nextId: 4 });
      },
      create: (opts) => {
        const id = -get().nextId;
        const room = newDemoRoom(id, opts);
        set((s) => ({ rooms: [room, ...s.rooms], nextId: s.nextId + 1 }));
        return room;
      },
      put: (room) => set((s) => ({ rooms: s.rooms.map((r) => (r.id === room.id ? room : r)) })),
      remove: (id) => set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) })),
      reset: () => set({ rooms: [], seeded: false, nextId: 4 }),
    }),
    {
      name: "cv.draft.demo",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ rooms: s.rooms, seeded: s.seeded, nextId: s.nextId }),
      // Read after mount: the server renders no rooms, and so must the first client render.
      skipHydration: true,
    }
  )
);

/**
 * The demo store once it has read the session's rooms and seeded the first
 * three. Hydration is read off the store itself on every render, never kept in
 * component state: a fast refresh can swap in a fresh, unread store under a
 * mounted component, and seeding that one would overwrite the session's rooms.
 */
export function useDemoReady(points: DemoFixture | null): boolean {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  // No storage on the server, so no persist API there either.
  const hydrated = useDemoDrafts.persist?.hasHydrated() ?? false;
  const seeded = useDemoDrafts((s) => s.seeded);
  const seed = useDemoDrafts((s) => s.seed);
  useEffect(() => {
    if (hydrated) return;
    const off = useDemoDrafts.persist.onFinishHydration(() => rerender());
    void useDemoDrafts.persist.rehydrate();
    return off;
  }, [hydrated]);
  useEffect(() => {
    if (hydrated && points && !seeded) seed(points);
  }, [hydrated, points, seeded, seed]);
  return hydrated && seeded;
}
