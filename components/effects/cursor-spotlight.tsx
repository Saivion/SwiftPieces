"use client";
import { useRef, type ReactNode, type PointerEvent } from "react";
import { cn } from "@/lib/cn";

/** Pointer-tracked accent highlight on a surface. Writes CSS vars, no re-renders. */
export function Spotlight({ children, className, radius = 240, strength = 0.14, id }: { children: ReactNode; className?: string; radius?: number; strength?: number; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} id={id} onPointerMove={onMove} className={cn("group/spot relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{ background: `radial-gradient(${radius}px circle at var(--sx, 50%) var(--sy, 50%), rgba(186,255,41,${strength}), transparent 60%)` }}
      />
      {children}
    </div>
  );
}
