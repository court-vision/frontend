/**
 * A Home row opening into a desk: the desk is uncovered from the row's box outward, so going in
 * reads as zooming in. It rides the browser's View Transitions where there are any, and is a
 * plain navigation everywhere else (no support, or the viewer asked for less motion).
 *
 * The box is measured before leaving and handed to the stylesheet as `--desk-zoom-from` on the
 * root; the page being left holds still while the desk grows over it (the rules are in
 * `app/globals.css`). The browser keeps the old page's frame until the desk says it is on screen
 * (`ZoomArrival`, in the desks' layout).
 */

/** How long the old page is held for the new one before letting go (it then just appears). */
const ARRIVAL_MS = 1500;

type Starter = (update: () => Promise<void> | void) => { finished: Promise<void> };

let arrive: (() => void) | null = null;

/** The box as an inset of the viewport, the shape the desk starts from. */
export function insetOf(box: { top: number; left: number; right: number; bottom: number }, width: number, height: number): string {
  const px = (n: number) => `${Math.max(0, Math.round(n))}px`;
  return `inset(${px(box.top)} ${px(width - box.right)} ${px(height - box.bottom)} ${px(box.left)} round 6px)`;
}

/** Navigate with `go`, growing the desk it leads to out of `from`. */
export function zoomTo(from: HTMLElement | null, go: () => void): void {
  const start = typeof document !== "undefined" ? (document as Document & { startViewTransition?: Starter }).startViewTransition : undefined;
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!from || !start || still || arrive) {
    go();
    return;
  }
  const root = document.documentElement;
  root.style.setProperty("--desk-zoom-from", insetOf(from.getBoundingClientRect(), window.innerWidth, window.innerHeight));
  root.dataset.deskZoom = "";
  const transition = start.call(document, () =>
    new Promise<void>((resolve) => {
      const done = () => {
        window.clearTimeout(timer);
        arrive = null;
        resolve();
      };
      const timer = window.setTimeout(done, ARRIVAL_MS);
      arrive = done;
      go();
    })
  );
  transition.finished
    .catch(() => {})
    .finally(() => {
      delete root.dataset.deskZoom;
      root.style.removeProperty("--desk-zoom-from");
    });
}

/** A desk is on screen: if a row was opening into it, the desk can grow now. */
export function zoomArrived(): void {
  arrive?.();
}
