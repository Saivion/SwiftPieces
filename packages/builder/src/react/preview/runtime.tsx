"use client";
// The interactive runtime every renderer runs inside. The preview is a tiny app, not a picture:
// a tap can push a screen, present a sheet or go back; a control keeps local state the way a
// SwiftUI @State does; a commit fires a haptic the device shows. Renderers reach all of it through
// these hooks, so the same renderer works in the Playground, in Pro, and in any future host.
import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import type { ComponentRegistry } from "../../core/registry.js";

/** The feedback kinds `.sensoryFeedback` offers that the preview can show. */
export type HapticKind = "selection" | "light" | "medium" | "rigid" | "soft" | "success" | "warning" | "error" | "increase" | "decrease";

export const HAPTIC_SWIFT: Record<HapticKind, string> = {
  selection: ".selection",
  light: ".impact(weight: .light)",
  medium: ".impact(weight: .medium)",
  rigid: ".impact(flexibility: .rigid)",
  soft: ".impact(flexibility: .soft)",
  success: ".success",
  warning: ".warning",
  error: ".error",
  increase: ".increase",
  decrease: ".decrease",
};

export type Runtime = {
  registry: ComponentRegistry;
  /**
   * Follows a link value (a screen id to push, "sheet:<id>" to present, "back" to pop or dismiss).
   * Returns false when the link leads nowhere, so a control can fall back to its own behaviour.
   */
  act(link: string): boolean;
  /** Shows a haptic: a pulse where it happened and the feedback's name, as it would feel on iPhone. */
  haptic(kind: HapticKind, from?: Element | null): void;
  /** The device's scale on the page. Divide pointer deltas by it to get points. */
  scale(): number;
  /** A renderer failed; the host records it. */
  onError(component: string): void;
  /**
   * The phone-wide layer for things that cover the whole screen (a toast, a menu, a confirmation
   * sheet a component presents). Portal into it; it sits above every screen and sheet.
   */
  overlay(): HTMLElement | null;
  /** Selection shared by siblings: option cards in one group, one tab of several. */
  choices: ChoiceBus;
  /** A still picture of the screen (a thumbnail, the canvas of every screen): nothing starts playing. */
  still?: boolean;
};

/** A tiny shared-selection store, one per device, keyed by group name. */
export type ChoiceBus = { get(group: string): string | null; set(group: string, id: string | null): void; subscribe(fn: () => void): () => void };

export function createChoiceBus(): ChoiceBus {
  const values = new Map<string, string | null>();
  const listeners = new Set<() => void>();
  return {
    get: (g) => values.get(g) ?? null,
    set(g, id) {
      if (values.get(g) === id) return;
      values.set(g, id);
      listeners.forEach((l) => l());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

const noop: Runtime = { registry: { all: [], get: () => undefined, listed: () => [], usable: () => false }, act: () => false, haptic: () => {}, scale: () => 1, onError: () => {}, overlay: () => null, choices: createChoiceBus() };
export const RuntimeContext = createContext<Runtime>(noop);
export const useRuntime = () => useContext(RuntimeContext);

/**
 * Local state that follows its prop: a Toggle starts at `isOn`, flips when tapped, and snaps back
 * to the new value whenever the property is remixed. SwiftUI's `@State` seeded from a parameter.
 */
export function useLive<T>(value: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState(value);
  const seed = useRef(value);
  if (seed.current !== value) {
    seed.current = value;
    setState(value);
  }
  return [state, setState];
}

/**
 * One option of a group (SwiftUI: several buttons writing one `@State`). The first option that
 * starts selected claims the group; tapping any option selects it and deselects the rest.
 */
export function useChoice(group: string, id: string, startsSelected: boolean): [boolean, () => void] {
  const { choices } = useRuntime();
  const claimed = useRef(false);
  if (!claimed.current) {
    claimed.current = true;
    if (startsSelected && choices.get(group) === null) choices.set(group, id);
  }
  const selected = useSyncExternalStore(choices.subscribe, () => choices.get(group) === id, () => startsSelected);
  return [selected, () => choices.set(group, id)];
}

/** A tap handler that follows the node's link and fires a light haptic. */
export function useTap(link: unknown, haptic: HapticKind | null = "light") {
  const rt = useRuntime();
  return useCallback(
    (e?: { currentTarget: Element } | null) => {
      if (haptic) rt.haptic(haptic, e?.currentTarget);
      return rt.act(typeof link === "string" ? link : "");
    },
    [rt, link, haptic],
  );
}

export type DragInfo = { dx: number; dy: number; vx: number; vy: number; x: number; y: number; el: HTMLElement };
export type DragHandlers = {
  onStart?(info: DragInfo): void;
  onMove?(info: DragInfo): void;
  onEnd?(info: DragInfo): void;
  /** Pixels in points before a drag starts; below it a release is a tap. Default 4. */
  slop?: number;
  /** Only claim drags along this axis, so the screen can still scroll the other way. */
  axis?: "x" | "y";
};

/**
 * Pointer drags in points, with velocity, for swipes, scrubs and sheets. Returns the handler for
 * `onPointerDown`. The element captures the pointer, so a drag keeps tracking outside it.
 */
export function useDrag(handlers: DragHandlers) {
  const rt = useRuntime();
  const ref = useRef(handlers);
  ref.current = handlers;
  return useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const el = e.currentTarget;
      const scale = rt.scale() || 1;
      const x0 = e.clientX;
      const y0 = e.clientY;
      const rect = el.getBoundingClientRect();
      let last = { t: performance.now(), x: x0, y: y0 };
      let v = { x: 0, y: 0 };
      let started = false;
      const slop = ref.current.slop ?? 4;
      const info = (ev: PointerEvent): DragInfo => ({
        dx: (ev.clientX - x0) / scale,
        dy: (ev.clientY - y0) / scale,
        vx: v.x,
        vy: v.y,
        x: (ev.clientX - rect.left) / scale,
        y: (ev.clientY - rect.top) / scale,
        el,
      });
      const move = (ev: PointerEvent) => {
        const now = performance.now();
        const dt = Math.max(1, now - last.t);
        v = { x: (((ev.clientX - last.x) / scale) / dt) * 1000, y: (((ev.clientY - last.y) / scale) / dt) * 1000 };
        last = { t: now, x: ev.clientX, y: ev.clientY };
        const i = info(ev);
        if (!started) {
          const ax = Math.abs(i.dx);
          const ay = Math.abs(i.dy);
          if (Math.max(ax, ay) < slop) return;
          const axis = ref.current.axis;
          if (axis === "x" && ay > ax) return end(ev, true);
          if (axis === "y" && ax > ay) return end(ev, true);
          started = true;
          try {
            el.setPointerCapture(ev.pointerId);
          } catch {}
          ref.current.onStart?.(i);
        }
        ref.current.onMove?.(i);
      };
      const end = (ev: PointerEvent, cancelled = false) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (started && !cancelled) {
          // A drag that ends in a still finger has no velocity.
          if (performance.now() - last.t > 80) v = { x: 0, y: 0 };
          ref.current.onEnd?.(info(ev));
          // Swallow the click a drag would otherwise produce.
          const swallow = (c: Event) => {
            c.stopPropagation();
            c.preventDefault();
          };
          el.addEventListener("click", swallow, { capture: true, once: true });
          setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0);
        }
      };
      const up = (ev: PointerEvent) => end(ev);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      if (slop === 0) {
        started = true;
        ref.current.onStart?.(info(e.nativeEvent));
      }
    },
    [rt],
  );
}

/** Spring-ish easing the preview uses for settles: fast out, soft landing, like `.snappy`. */
export const SPRING = "var(--spb-spring, cubic-bezier(.32, .72, 0, 1))";
/** A bouncier settle with a little overshoot, like `.bouncy`. */
export const BOUNCE = "var(--spb-bounce, cubic-bezier(.34, 1.4, .64, 1))";

/**
 * `SPRING` and `BOUNCE` are CSS, so they work in a `transition`, but the Web Animations API takes only a
 * plain timing function and throws on `var(...)`. This resolves the variable against `el` (the theme sets
 * it on the screen) and falls back to the curve written after the comma.
 */
export function resolveEasing(el: Element, value: string): string {
  const m = /^var\(\s*(--[\w-]+)\s*,\s*(.+)\)$/.exec(value.trim());
  if (!m) return value;
  const own = getComputedStyle(el).getPropertyValue(m[1]).trim();
  return own || m[2].trim();
}
