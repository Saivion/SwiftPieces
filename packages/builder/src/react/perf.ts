// Performance marks for the builder, with budgets. Everything is local: numbers are kept in memory,
// readable as `window.__spBuilderPerf` (and `.report()` in the console), and a small summary can be
// handed to analytics once per session. No observers or timers run unless something is measured.

export const budgets = {
  /** Shell mounted to first preview painted. */
  init: 400,
  /** A property change to the next painted frame. */
  propertyUpdate: 50,
  /** Tree → SwiftUI for the current project. */
  codegen: 16,
  /** Building a whole project archive, sources already fetched. */
  export: 500,
  /** Clicking a component to it being selected on screen. */
  select: 50,
} as const;
export type Metric = keyof typeof budgets;

type Sample = { n: number; total: number; max: number; last: number };
const samples = new Map<Metric, Sample>();

export function record(metric: Metric, ms: number) {
  const s = samples.get(metric) ?? { n: 0, total: 0, max: 0, last: 0 };
  s.n++;
  s.total += ms;
  s.max = Math.max(s.max, ms);
  s.last = ms;
  samples.set(metric, s);
}

/** Measures from now until the browser has painted the next frame. */
export function untilPaint(metric: Metric, start = performance.now()) {
  if (typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => setTimeout(() => record(metric, performance.now() - start), 0));
}

export function timed<T>(metric: Metric, fn: () => T): T {
  const t = performance.now();
  try {
    return fn();
  } finally {
    record(metric, performance.now() - t);
  }
}

export function summary() {
  const out: Record<string, { avg: number; max: number; last: number; n: number; budget: number; ok: boolean }> = {};
  for (const [k, s] of samples) {
    const avg = s.total / s.n;
    out[k] = { avg: Math.round(avg * 10) / 10, max: Math.round(s.max * 10) / 10, last: Math.round(s.last * 10) / 10, n: s.n, budget: budgets[k], ok: s.max <= budgets[k] };
  }
  return out;
}

if (typeof window !== "undefined") {
  (window as unknown as { __spBuilderPerf: unknown }).__spBuilderPerf = {
    summary,
    report: () => console.table(summary()),
    memory: () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
  };
}
