// The SwiftPieces motion language for the web previews: the same five spring tiers and named roles as
// registry/foundation/PieceMotion.swift, turned into CSS easings, so a preview moves the way the piece it
// shows does. A spring becomes a `linear()` easing sampled from its own step response, over the time it
// takes to settle. The output is the same on the server and in the browser, so server-rendered previews
// hydrate cleanly; a browser without `linear()` (all current ones have it) skips the transition and jumps.
//
// Use a role, never a hand-written curve: `transition: t("transform", "snap")`. The site's reduced-motion
// rule (packages/brand/theme.css) already flattens every transition; `reduced()` is for scripted loops
// that should also skip a movement (a shake, a pop, a stretch) rather than play it instantly.

/** A spring as Swift writes it: `Spring(duration:bounce:)`. `duration` is the response, not the settle time. */
export type Spring = { duration: number; bounce: number };

/** The five tiers. Overshoot and timing match Swift's Spring exactly. */
export const tiers = {
  /** No overshoot, 90% in about 90ms. A press arriving under the finger. */
  tight: { duration: 0.14, bounce: 0 },
  /** About 2.8% overshoot. Landing on a detent, segment or page. */
  responsive: { duration: 0.32, bounce: 0.25 },
  /** About 8.4% overshoot. A release, a return from past an edge, a drag settling home. */
  elastic: { duration: 0.42, bounce: 0.38 },
  /** About 15% overshoot. A resolved action landing, at most once per interaction. */
  expressive: { duration: 0.48, bounce: 0.48 },
  /** About 1.5% overshoot, unhurried. Opening large surfaces, ambient change. */
  calm: { duration: 0.5, bounce: 0.2 },
} as const satisfies Record<string, Spring>;

/** The roles, as in PieceMotion. Each names what just happened, not how it moves. */
export const roles = {
  press: tiers.tight,
  release: tiers.elastic,
  settle: tiers.elastic,
  snap: tiers.responsive,
  /** A number or chart value people read: never overshoots, so it never shows a value that isn't true. */
  value: { duration: 0.35, bounce: 0 },
  rebound: tiers.elastic,
  /** Size, corner radius or shape changes, with a little give at the end. */
  morph: { duration: 0.4, bounce: 0.2 },
  reveal: tiers.calm,
  /** Closing is quicker and firmer than opening. */
  dismiss: { duration: 0.3, bounce: 0.08 },
  success: tiers.expressive,
  error: tiers.responsive,
  ambient: tiers.calm,
} as const satisfies Record<string, Spring>;

export type Role = keyof typeof roles;

/** Position of a spring released from rest at 0 toward 1, `t` seconds in. The same closed form Swift uses. */
export function springValue(s: Spring, t: number): number {
  const w = (2 * Math.PI) / s.duration;
  const z = 1 - Math.min(Math.max(s.bounce, 0), 0.99);
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** Seconds until the spring stays within 0.1% of its target. */
export function settleTime(s: Spring): number {
  let last = 0;
  for (let t = 0; t < 3; t += 0.002) if (Math.abs(springValue(s, t) - 1) > 0.001) last = t;
  return Math.max(last, 0.05);
}

const cache = new Map<string, { easing: string; ms: number }>();

/** A spring as a CSS easing plus the duration it needs, in milliseconds. */
export function curve(spring: Role | Spring): { easing: string; ms: number } {
  const s = typeof spring === "string" ? roles[spring] : spring;
  const key = `${s.duration}:${s.bounce}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const total = settleTime(s);
  const steps = Math.max(24, Math.min(80, Math.round(total / 0.016)));
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const v = i === steps ? 1 : springValue(s, p * total);
    points.push(i === 0 || i === steps ? v.toFixed(0) : `${v.toFixed(4)} ${(p * 100).toFixed(2)}%`);
  }
  const out = { easing: `linear(${points.join(", ")})`, ms: Math.round(total * 1000) };
  cache.set(key, out);
  return out;
}

/** A `transition` value: `t("transform", "snap")`, `t(["transform", "opacity"], "dismiss", 60)`. */
export function t(props: string | string[], spring: Role | Spring, delayMs = 0): string {
  const { easing, ms } = curve(spring);
  return (Array.isArray(props) ? props : [props]).map((p) => `${p} ${ms}ms ${easing}${delayMs ? ` ${Math.round(delayMs)}ms` : ""}`).join(", ");
}

/** Settle time of a role or spring, in milliseconds: how long to hold a scripted step so it lands. */
export const ms = (spring: Role | Spring) => curve(spring).ms;

/** Follow-through: rank 0 leads; each later rank gets a slightly longer, looser spring and arrives a beat later. */
export function follow(spring: Role | Spring, rank: number): Spring {
  const s = typeof spring === "string" ? roles[spring] : spring;
  const k = Math.min(Math.max(rank, 0), 6);
  return { duration: s.duration + 0.04 * k, bounce: Math.min(s.bounce + 0.02 * k, 0.55) };
}

/** One-shot entrances: item `index` waits 30ms per place, capped at the seventh. Exits go together. */
export const cascade = (index: number, step = 30) => Math.min(Math.max(index, 0), 7) * step;

/** A scroll view's edge resistance: how far something travels when pulled `overshoot` past a limit. */
export function rubberBand(overshoot: number, limit: number, coefficient = 0.55): number {
  if (limit <= 0 || overshoot === 0) return 0;
  const banded = (1 - 1 / ((Math.abs(overshoot) * coefficient) / limit + 1)) * limit;
  return overshoot < 0 ? -banded : banded;
}

/** About `depth` points per edge, not a fixed percentage: an icon sinks to 0.92, a pill 0.95, a card 0.985. */
export function pressScale(width: number, height: number, depth = 2.5): number {
  const side = Math.sqrt(Math.max(width, 1) * Math.max(height, 1));
  return Math.min(Math.max(1 - (depth * 2) / side, 0.92), 0.985);
}

/** A stretch along any direction that thins across it and keeps the area, as a CSS `matrix()`. */
export function stretch(dx: number, dy: number): string {
  const amount = Math.min(Math.hypot(dx, dy), 0.2);
  if (amount < 0.0005) return "none";
  const c = dx / amount, s = dy / amount, along = 1 + amount, across = 1 / along, k = along - across;
  const f = (n: number) => n.toFixed(5);
  return `matrix(${f(across + k * c * c)}, ${f(k * c * s)}, ${f(k * c * s)}, ${f(across + k * s * s)}, 0, 0)`;
}

/** Anticipation, overshoot, settle, as Web Animations keyframes (`el.animate(...pop())`). */
export function pop(amount = 0.08): [Keyframe[], KeyframeAnimationOptions] {
  return [[
    { transform: "scale(1)", offset: 0 },
    { transform: `scale(${1 - amount * 0.4})`, offset: 0.12, easing: "cubic-bezier(0.33, 0, 0.67, 1)" },
    { transform: `scale(${1 + amount})`, offset: 0.33, easing: curve("success").easing },
    { transform: "scale(1)", offset: 1 },
  ], { duration: 640 }];
}

/** A short decaying side-to-side shake for refused input (`el.animate(...shake(u))` with a unit function). */
export function shake(unit: (n: number) => string = (n) => `${n}px`, distance = 8): [Keyframe[], KeyframeAnimationOptions] {
  const xs = [0, -distance, distance * 0.75, -distance * 0.5, distance * 0.25, 0];
  return [xs.map((x) => ({ transform: `translateX(${unit(x)})` })), { duration: 380, easing: "ease-out" }];
}

/** True when the visitor asked for reduced motion: skip movements entirely and keep colour and state changes. */
export const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
