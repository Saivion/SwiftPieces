"use client";
// The bento canvas's motion language: one clock every card reads, and the curves they move on.
// Every card is a pure function of the clock's time `t` (seconds), so all of them run at once,
// each on its own cycle, with nothing to set up or tear down per card. The clock runs only while
// the canvas is on screen and the tab is visible, and stands still for reduced motion.
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

let now = 0;
let start = 0;
let frame = 0;
let running = false;
const listeners = new Set<() => void>();
const holds = new Set<symbol>();

function tick(ms: number) {
  if (!start) start = ms - now * 1000;
  now = (ms - start) / 1000;
  for (const l of listeners) l();
  frame = requestAnimationFrame(tick);
}

function sync() {
  const go = listeners.size > 0 && holds.size === 0;
  if (go === running) return;
  running = go;
  if (go) {
    start = 0;
    frame = requestAnimationFrame(tick);
  } else cancelAnimationFrame(frame);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  sync();
  return () => {
    listeners.delete(l);
    sync();
  };
};

/** Where the clock stands for reduced motion: a moment where every card shows something. */
const STILL = 5.6;

/** The clock's time in seconds; every card that reads it redraws each frame. */
export function useTime(): number {
  return useSyncExternalStore(subscribe, () => now, () => STILL);
}

/**
 * Holds the clock while `paused` (the canvas is off screen, the tab hidden, or motion reduced),
 * resuming where it stopped so no card jumps.
 */
export function useClockHold(paused: boolean) {
  useEffect(() => {
    if (!paused) return;
    const id = Symbol("hold");
    holds.add(id);
    sync();
    return () => {
      holds.delete(id);
      sync();
    };
  }, [paused]);
}

/** Puts the clock at the still moment (reduced motion). */
export function stillClock() {
  now = STILL;
  for (const l of listeners) l();
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Critically damped, from rest, no overshoot: crossfades, colour flips, pushes. */
export const soft = (p: number) => {
  const x = clamp01(p);
  const f = (q: number) => 1 - (1 + 7 * q) * Math.exp(-7 * q);
  return f(x) / f(1);
};
/** Ease-out expo: opacity reveals only. */
export const expo = (p: number) => {
  const x = clamp01(p);
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
};
/** Quintic in-out: long travel. */
export const io = (p: number) => {
  const x = clamp01(p);
  return x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2;
};

export type Ease = (p: number) => number;

/**
 * A damped spring from rest, normalised so p = 1 lands exactly on 1. The style's Motion sets its
 * character: Smooth settles with a touch of overshoot, Snappy barely any, Bouncy springs past.
 */
function springOf(zeta: number, turns: number): Ease {
  const w = 2 * Math.PI * turns;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const k = zeta / Math.sqrt(1 - zeta * zeta);
  const f = (q: number) => 1 - Math.exp(-zeta * w * q) * (Math.cos(wd * q) + k * Math.sin(wd * q));
  const end = f(1);
  return (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : f(p) / end);
}

export const SPRINGS: Record<"smooth" | "snappy" | "bouncy", Ease> = {
  smooth: springOf(0.62, 1.15),
  snappy: springOf(0.82, 1.35),
  bouncy: springOf(0.4, 1.25),
};

export const SpringContext = createContext<Ease>(SPRINGS.smooth);
/** The style's spring. */
export const useSpring = () => useContext(SpringContext);

/**
 * Where `t` is in a cycle of `period` seconds that first starts at `offset`: the cycle's index
 * (-1 before the first) and the seconds into it.
 */
export function cycle(t: number, period: number, offset = 0): { k: number; l: number } {
  const x = t - offset;
  if (x < 0) return { k: -1, l: x + period };
  const k = Math.floor(x / period);
  return { k, l: x - k * period };
}

/**
 * Steps through `values`, one per cycle: the value it's leaving, the one it's going to, and how far
 * (0 to 1, over `dur` seconds from the start of each cycle).
 */
export function stepper<T>(t: number, period: number, offset: number, values: readonly T[], dur: number): { from: T; to: T; p: number; i: number } {
  const { k, l } = cycle(t, period, offset);
  const n = values.length;
  if (k < 0) return { from: values[0], to: values[0], p: 1, i: 0 };
  const i = (k + 1) % n;
  return { from: values[k % n], to: values[i], p: clamp01(l / dur), i };
}
