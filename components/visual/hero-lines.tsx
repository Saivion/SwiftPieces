"use client";
import { useEffect, useRef } from "react";
import { createRibbon, type RibbonMessage } from "@/components/visual/hero-ribbon";

/**
 * The hero's ground: a ribbon of hairlines that rises from the bottom left and twists toward the top
 * right, with light surging along each line. The
 * drawing itself is in hero-ribbon.ts.
 *
 * The ribbon is a family of curves around one centreline. Each line sits at its own offset across the
 * ribbon's width, and that offset turns with a slow twist, so the lines cross over one another the way
 * a real ribbon of threads does. Colour runs across the ribbon in the brand's palette.
 *
 * Since 2026-10-21 the ribbon is "silk": each thread is brighter where it faces the viewer and fades
 * where it turns away, a sheen lights the threads where it turns edge-on, colour drifts slowly up each
 * thread, and a blurred aura in the ribbon's colours sits behind on its own small canvas.
 *
 * It draws in a worker (hero-lines.worker.ts) on canvases handed over with transferControlToOffscreen,
 * the way SwiftPieces Pro's ribbon does, so however much the ribbon draws, the page's own thread stays
 * free for scrolling and input. Browsers that can't hand a canvas to a worker draw on the page.
 *
 * Unlike the rest of the first screen it does not wait for the motion gate: it starts on mount, each
 * line drawing itself across the screen with a bright tip, then flows. It stops while off screen or in
 * a hidden tab, and Reduce Motion gets the finished ribbon, still.
 *
 * The canvases are made here rather than rendered: a canvas can be handed over only once, and React's
 * development double mount would try twice on the same element.
 */
export function HeroLines() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // The aura behind, a sixth of the hero's size and scaled up by the browser; the threads in front.
    const glow = document.createElement("canvas");
    const canvas = document.createElement("canvas");
    glow.className = canvas.className = "absolute inset-0 block h-full w-full";
    host.appendChild(glow);
    host.appendChild(canvas);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The site's theme (next-themes puts `dark` on <html>): the aura adds light on dark and tints on light.
    const isDark = () => document.documentElement.classList.contains("dark");
    // Started from the ResizeObserver's first report, which carries the canvas's size, so mounting
    // never forces a layout of its own.
    let engine: Engine | null = null;
    let onScreen = true;
    const ro = new ResizeObserver(([e]) => {
      const size = { w: e.contentRect.width, h: e.contentRect.height, dpr: window.devicePixelRatio || 1 };
      if (engine) engine.post({ type: "resize", ...size });
      else engine = "transferControlToOffscreen" in canvas && typeof Worker !== "undefined" ? inWorker(canvas, glow, reduced, isDark(), size) : onPage(canvas, glow, reduced, isDark(), size);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      engine?.post({ type: "visible", visible: onScreen && !document.hidden });
    });
    io.observe(canvas);
    const onVisibility = () => engine?.post({ type: "visible", visible: onScreen && !document.hidden });
    document.addEventListener("visibilitychange", onVisibility);
    let dark = isDark();
    const theme = new MutationObserver(() => {
      if (isDark() === dark) return;
      dark = isDark();
      engine?.post({ type: "tone", dark });
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      io.disconnect();
      ro.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engine?.stop();
      glow.remove();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      // Faded out behind the copy inside the drawing itself, so the headline and buttons sit on clean ground.
      // It starts a navbar's height (and the announcement bar's, --promo-h) above the hero and runs up behind the fixed navbar to the top of the
      // page, so the ribbon leaves through the top of the window instead of stopping at a hard edge
      // under the bar.
      className="pointer-events-none absolute inset-x-0 bottom-0 -top-[calc(var(--nav-h)+var(--promo-h))] z-0 h-[calc(100%+var(--nav-h)+var(--promo-h))] w-full"
    />
  );
}

type Engine = { post: (m: Exclude<RibbonMessage, { type: "init" }>) => void; stop: () => void };
type Size = { w: number; h: number; dpr: number };

/** The ribbon in a worker. Falls back to the page if the worker can't start. */
function inWorker(canvas: HTMLCanvasElement, glow: HTMLCanvasElement, reduced: boolean, dark: boolean, size: Size): Engine | null {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./hero-lines.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return onPage(canvas, glow, reduced, dark, size);
  }
  const offscreen = canvas.transferControlToOffscreen();
  const offscreenGlow = glow.transferControlToOffscreen();
  worker.postMessage({ type: "init", canvas: offscreen, glow: offscreenGlow, reduced, dark, ...size } satisfies RibbonMessage, [offscreen, offscreenGlow]);
  return { post: (m) => worker.postMessage(m), stop: () => worker.terminate() };
}

/** The ribbon on the page's own thread, for browsers that can't hand a canvas to a worker. */
function onPage(canvas: HTMLCanvasElement, glow: HTMLCanvasElement, reduced: boolean, dark: boolean, size: Size): Engine | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const ribbon = createRibbon(canvas, ctx, glow, glow.getContext("2d"), reduced, dark);
  ribbon.resize(size.w, size.h, size.dpr);
  let raf = 0;
  let visible = true;
  const tick = (now: number) => {
    raf = 0;
    if (visible && ribbon.frame(now)) raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (!raf && visible) raf = requestAnimationFrame(tick);
  };
  start();
  return {
    post: (m) => {
      if (m.type === "resize") {
        ribbon.resize(m.w, m.h, m.dpr);
        ribbon.redraw(performance.now());
      } else if (m.type === "tone") {
        ribbon.setDark(m.dark);
        ribbon.redraw(performance.now());
      } else {
        visible = m.visible;
        start();
      }
    },
    stop: () => cancelAnimationFrame(raf),
  };
}
