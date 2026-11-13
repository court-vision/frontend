import { afterEach, expect, test } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { cancelCatchUp, catchUp, catchUpPending } from "@/lib/catch-up-reads";

const TEAM = 7;
const KEY = ["lineup", "state", TEAM] as const;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let client: QueryClient;
let stop = () => {};

afterEach(() => {
  cancelCatchUp(TEAM);
  stop();
  client.clear();
});

/** A mounted read whose answers are counted; `slow` holds each answer that long. */
function mounted(slow = 0) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const reads = { started: 0, answered: 0 };
  const observer = new QueryObserver(client, {
    queryKey: KEY,
    staleTime: 60_000,
    queryFn: async () => {
      reads.started += 1;
      await wait(slow);
      reads.answered += 1;
      return reads.started;
    },
  });
  stop = observer.subscribe(() => {});
  return reads;
}

test("reads again after each delay, then has nothing waiting", async () => {
  const reads = mounted();
  await wait(5);
  expect(reads.started).toBe(1);

  catchUp(client, TEAM, [{ queryKey: KEY }], [10, 30]);
  expect(catchUpPending(TEAM)).toBe(true);
  await wait(20);
  expect(reads.started).toBe(2);
  await wait(30);
  expect(reads.started).toBe(3);
  expect(catchUpPending(TEAM)).toBe(false);
});

test("a team's next catch-up replaces the one waiting", async () => {
  const reads = mounted();
  await wait(5);
  catchUp(client, TEAM, [{ queryKey: KEY }], [10]);
  cancelCatchUp(TEAM);
  await wait(25);
  expect(reads.started).toBe(1);
  expect(catchUpPending(TEAM)).toBe(false);
});

test("joins a read already out instead of calling it off, so a send awaiting it isn't failed", async () => {
  const reads = mounted(30);
  await wait(40);
  // The send's own read of today's board, as useDayBoards' `refresh` makes it.
  const refresh = client.fetchQuery({ queryKey: KEY, staleTime: 0 });
  catchUp(client, TEAM, [{ queryKey: KEY }], [5]);
  await expect(refresh).resolves.toBe(2);
  expect(reads).toEqual({ started: 2, answered: 2 });
});
