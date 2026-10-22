"use client";
import { useEffect, useRef } from "react";
import { type GrainKind, grainSpec, paintGrain } from "@/lib/grain";
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

/**
 * The ground every preview stands on: soft colour fields under a fine grain, with a white line motif.
 * `kind` sets the palette and motif, so every screen card reads as a screen and every flow as a flow;
 * the seed moves the fields and places the motif, so each stage is its own. Ported from
 * SwiftPiecesPro (components/previews/grain-stage.tsx).
 */
export function GrainStage({
  seed,
  kind = "brand",
  lines = true,
  className,
}: {
  seed: string;
  kind?: GrainKind;
  lines?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = grainSpec(seed, kind, lines);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const recipe = grainSpec(seed, kind, lines);
    let near = false;
    let cancel: (() => void) | null = null;
    let painted = "";

    const draw = () => {
      cancel = null;
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // Painted already at this size (a ResizeObserver reports the size it starts with, too).
      if (painted === `${w}x${h}@${dpr}`) return;
      paintGrain(canvas, w, h, dpr, recipe);
      painted = `${w}x${h}@${dpr}`;
    };
    const request = () => {
      if (near && !cancel) cancel = enqueue(draw);
    };

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
  }, [seed, kind, lines]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      style={{ background: spec.fallback }}
    />
  );
}
