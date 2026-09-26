"use client";
import { useEffect } from "react";

const EVENTS = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll", "wheel"] as const;

/**
 * How long after the page has loaded the gate opens on its own, if nobody has interacted yet. Then
 * the browser is asked for an idle moment (up to AUTO_IDLE_MS more), so the first frames of motion
 * never compete with late loading work. The first paint still settles still, which is what the gate
 * exists for; the page just no longer waits for the mouse to come alive.
 */
const AUTO_OPEN_MS = 1200;
const AUTO_IDLE_MS = 1000;

/**
 * The motion gate. The first screen's endless loops (the ticker, the Pro count shimmer, the hero
 * mark) hold still until the visitor first interacts, or until the page has loaded and gone idle, so the
 * page paints complete and settled. Then this sets `data-motion` on <html>, which CSS reads
 * (globals.css), and fires `sp:motion`, which the hero canvas listens for.
 *
 * A client component rather than a script tag: it rides in the bundle the page already loads, so it
 * costs no request, no preload and no inline HTML.
 */
export function MotionGate() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.motion) return;
    const go = () => {
      if (root.dataset.motion) return;
      root.dataset.motion = "on";
      EVENTS.forEach((e) => window.removeEventListener(e, go));
      window.dispatchEvent(new Event("sp:motion"));
    };
    EVENTS.forEach((e) => window.addEventListener(e, go, { passive: true }));
    // Open by itself once the page has loaded and gone idle, so a refresh or a typed URL never
    // leaves the hero frozen until the pointer moves.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const soon = () => {
      timer = setTimeout(() => {
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(go, { timeout: AUTO_IDLE_MS });
        else go();
      }, AUTO_OPEN_MS);
    };
    if (document.readyState === "complete") soon();
    else window.addEventListener("load", soon, { once: true });
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, go));
      window.removeEventListener("load", soon);
      clearTimeout(timer);
      if (idle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
    };
  }, []);
  return null;
}
