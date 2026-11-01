"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { preload } from "react-dom";
import { type Core, type GrainKind, grainSpec, paintGrain } from "@/lib/grain";
import type { GrainStill } from "@/lib/plan-cover";
import { cn } from "@/lib/cn";

/**
 * Stage paints wait their turn, one per task. A page mounts many stages at once (the homepage has
 * over a dozen) and each paint is a few milliseconds of per-pixel work; painted in the same frame they
 * made one long task of about a quarter of a second on a slow machine, which PageSpeed counts as
 * blocking. Each stage also paints only once it nears the viewport, over its CSS fallback until then.
 */
const queue: Array<() => void> = [];
let draining = false;
function drain() {
  queue.shift()?.();
  if (queue.length) setTimeout(drain, 0);
  else draining = false;
}
function enqueue(job: () => void): () => void {
  queue.push(job);
  if (!draining) {
    draining = true;
    setTimeout(drain, 0);
  }
  return () => {
    const i = queue.indexOf(job);
    if (i >= 0) queue.splice(i, 1);
  };
}

/** Layout effects only in the browser: the server render keeps the still or the CSS fallback either way. */
const useStageEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The stage's layout size: unlike getBoundingClientRect, untouched by a reveal that is still running. */
function layoutSize(el: HTMLElement) {
  return { w: Math.max(1, el.offsetWidth), h: Math.max(1, el.offsetHeight) };
}

/**
 * The ground every preview stands on: soft colour fields under a fine grain, with a white line motif.
 * `kind` sets the palette and motif, so every screen card reads as a screen and every flow as a flow;
 * the seed moves the fields and places the motif, so each stage is its own. Ported from
 * SwiftPiecesPro (components/previews/grain-stage.tsx).
 *
 * `eager` is for a single small stage that is on screen from the start (the docs rail's Pro card):
 * it paints before the browser draws the frame, skipping the queue and the viewport wait, so it never
 * shows its fallback after a client navigation.
 *
 * `still` (the pricing card, lib/plan-cover.ts) is the same seed painted ahead of time: it is in the
 * server HTML, so the stage is complete on the first frame. At the still's size nothing else happens;
 * at any other size the canvas paints the exact size before the browser draws, and again on every
 * resize, so the field is never shown stretched or half-loaded.
 */
export function GrainStage({
  seed,
  kind = "brand",
  lines = true,
  eager = false,
  core,
  still,
  className,
}: {
  seed: string;
  kind?: GrainKind;
  lines?: boolean;
  eager?: boolean;
  /** Where a radial palette's core sits (Signature's): under the surface's words. */
  core?: Core;
  /** A pre-painted copy of this exact stage, shown at once (lib/plan-cover.ts). */
  still?: GrainStill;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = grainSpec(seed, kind, lines, core);

  if (still) preload(still.src, { as: "image", fetchPriority: "high" });

  useStageEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const recipe = grainSpec(seed, kind, lines, core);
    let near = false;
    let cancel: (() => void) | null = null;
    let painted = "";

    const draw = () => {
      cancel = null;
      const { w, h } = layoutSize(parent);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // Painted already at this size (a ResizeObserver reports the size it starts with, too).
      if (painted === `${w}x${h}@${dpr}`) return;
      paintGrain(canvas, w, h, dpr, recipe);
      painted = `${w}x${h}@${dpr}`;
    };
    const request = () => {
      if (near && !cancel) cancel = enqueue(draw);
    };

    if (still) {
      // The still covers its own size; anything else is painted now, inside this layout effect or the
      // resize callback, both of which run before the browser draws the frame.
      const sync = () => {
        const { w, h } = layoutSize(parent);
        const fits = Math.abs(w - still.width) <= 1 && Math.abs(h - still.height) <= 1;
        if (!fits) draw();
        canvas.style.visibility = fits ? "hidden" : "visible";
      };
      sync();
      const ro = new ResizeObserver(sync);
      ro.observe(parent);
      return () => ro.disconnect();
    }

    if (eager) {
      draw();
      const ro = new ResizeObserver(draw);
      ro.observe(parent);
      return () => ro.disconnect();
    }

    const ro = new ResizeObserver(request);
    ro.observe(parent);
    // The same reach as a phone's preview (PhoneFrame), so a stage is painted before it scrolls in.
    const io = new IntersectionObserver(([e]) => {
      near = Boolean(e?.isIntersecting);
      request();
    }, { rootMargin: "50% 0px 50% 0px" });
    io.observe(parent);
    return () => {
      ro.disconnect();
      io.disconnect();
      cancel?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the core is a literal per surface; its values are the dependency
  }, [seed, kind, lines, eager, core?.join(), still?.src]);

  if (still) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed still, already sized and compressed */}
        <img
          src={still.src}
          alt=""
          aria-hidden
          width={still.width}
          height={still.height}
          decoding="sync"
          fetchPriority="high"
          draggable={false}
          className={cn("pointer-events-none absolute inset-0 size-full select-none", className)}
          style={{ background: `url("${still.placeholder}") 0 0 / 100% 100% no-repeat, ${spec.fallback}` }}
        />
        <canvas ref={canvasRef} aria-hidden className={cn("pointer-events-none absolute inset-0 size-full", className)} style={{ visibility: "hidden" }} />
      </>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      style={{ background: `${spec.fallbackGradient}, ${spec.fallback}` }}
    />
  );
}
