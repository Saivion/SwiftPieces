/**
 * Draws the hero ribbon off the main thread, on the canvases hero-lines.tsx hands over. The page only
 * forwards their size, whether the hero is on screen and the site's theme.
 */
import { createRibbon, type Ribbon, type RibbonMessage } from "./hero-ribbon";

// The project compiles against the DOM library, not the worker one (both at once conflict), so the
// worker's own globals are typed here.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<RibbonMessage>) => void) | null;
  requestAnimationFrame?: (cb: (now: number) => void) => number;
};
// Every browser that can transfer a canvas to a worker also gives workers animation frames, but keep
// a timer behind it rather than trust that.
const nextFrame: (cb: (now: number) => void) => number =
  scope.requestAnimationFrame ? (cb) => scope.requestAnimationFrame!(cb) : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

let ribbon: Ribbon | null = null;
let raf = 0;
let visible = true;

const tick = (now: number) => {
  raf = 0;
  if (!ribbon || !visible) return;
  if (ribbon.frame(now)) raf = nextFrame(tick);
};
const start = () => {
  if (!raf && visible) raf = nextFrame(tick);
};

scope.onmessage = (e: MessageEvent<RibbonMessage>) => {
  const m = e.data;
  if (m.type === "init") {
    const ctx = m.canvas.getContext("2d");
    if (!ctx) return;
    ribbon = createRibbon(m.canvas, ctx, m.glow, m.glow.getContext("2d"), m.reduced, m.dark);
    ribbon.resize(m.w, m.h, m.dpr);
    start();
  } else if (m.type === "resize") {
    ribbon?.resize(m.w, m.h, m.dpr);
    ribbon?.redraw(performance.now());
  } else if (m.type === "tone") {
    // The site's theme changed: redraw now, so a still ribbon (Reduce Motion) follows it too.
    ribbon?.setDark(m.dark);
    ribbon?.redraw(performance.now());
  } else if (m.type === "visible") {
    visible = m.visible;
    start();
  }
};
