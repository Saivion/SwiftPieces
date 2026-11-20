"use client";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** True when the visitor asked for less motion: sequences then hold on their finished frame. */
function useReduced() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

/**
 * Plays a short scripted sequence: sets data-s on its box (0..n-1), holding each step for its ms,
 * then loops. CSS in globals.css (.seq) reveals .s1..s5 and types .type as the steps arrive.
 * Reduced motion shows the last step and stays there.
 */
export function Seq({ ms, className, children }: { ms: number[]; className?: string; children: ReactNode }) {
  const reduced = useReduced();
  const [s, setS] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setS((s + 1) % ms.length), ms[s]);
    return () => clearTimeout(t);
  }, [s, ms, reduced]);
  return <div data-s={reduced ? ms.length - 1 : s} className={cn("seq", className)}>{children}</div>;
}

/**
 * Shows one panel at a time and moves on every `ms`, with an index of every item that marks the one on
 * show (data-on) and jumps to an item on hover, focus or tap. Only the panel on show is mounted, so a
 * single video plays at a time. Reduced motion holds still until the visitor picks one.
 */
export function Cycle({ ms, className, label, items, panels }: { ms: number; className?: string; label: string; items: ReactNode[]; panels: ReactNode[] }) {
  const reduced = useReduced();
  const n = panels.length;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setI((i + 1) % n), ms);
    return () => clearTimeout(t);
  }, [i, n, ms, reduced]);
  return (
    <div className={className}>
      <div className="cycle-items" role="tablist" aria-label={label}>
        {items.map((it, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === i} data-on={k === i || undefined} onMouseEnter={() => setI(k)} onFocus={() => setI(k)} onClick={() => setI(k)} className="block text-left">
            {it}
          </button>
        ))}
      </div>
      <div className="cycle-panels relative" role="tabpanel">
        {panels.map((p, k) => (k === i ? <div key={k} className="cycle-panel">{p}</div> : null))}
      </div>
    </div>
  );
}
