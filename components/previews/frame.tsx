"use client";
import { useRef, type ReactNode } from "react";
import { useInView } from "@/lib/use-in-view";
import { cn } from "@/lib/cn";

/**
 * Preview stage. Children mount only while near the viewport so canvases and
 * timers never run off-screen. Aspect stays fixed so grids never reflow.
 * `clear` drops the ground entirely, for stages drawn straight onto a dashed frame (the landing visuals).
 * The stage is a size container, so previews can scale with `cqw`/`cqh` between the 330 px grid card and the 560 px docs header.
 */
export function PreviewFrame({ children, className, aspect = "aspect-[4/3]", tone = "dark" }: { children: ReactNode; className?: string; aspect?: string; tone?: "dark" | "black" | "light" | "clear" }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "20% 0px 20% 0px" });
  return (
    <div
      ref={ref}
      className={cn("relative isolate overflow-hidden rounded-[var(--radius)] select-none [container-type:size]", aspect, (tone === "dark" || tone === "black") && "stage-ground", tone === "light" && "bg-[#f0f0f0] text-black", tone === "clear" && "stage-clear", className)}
    >
      {inView ? children : null}
    </div>
  );
}

export function Center({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("absolute inset-0 flex items-center justify-center p-6", className)}>{children}</div>;
}
