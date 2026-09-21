"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "@/lib/use-in-view";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

export function Stat({ value, suffix = "", label, detail }: { value: number; suffix?: string; label: string; detail?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);

  useEffect(() => {
    if (!inView || reduced) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, value]);

  return (
    <div ref={ref} className="flex flex-col">
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-[clamp(2.5rem,2rem+2vw,4rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums">{n}</span>
        <span className="text-2xl font-semibold text-accent">{suffix}</span>
      </div>
      <p className="p-item mt-4 text-[17px]">{label}</p>
      {detail ? <p className="p-body mt-2">{detail}</p> : null}
    </div>
  );
}
