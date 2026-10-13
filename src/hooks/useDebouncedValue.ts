import { useEffect, useState } from "react";

/**
 * `value` once it has held still for `ms`; until then the last value that
 * did. For a query key that follows typing: one request when the typist
 * pauses instead of one per keystroke.
 */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
