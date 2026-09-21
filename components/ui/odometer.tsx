"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A number whose digits roll when it changes.
 *
 * The hero's view count is live: it is re-read every fifteen seconds and does move. Nothing about
 * a static figure says so, and the two obvious ways of saying it are both taken — the eyebrow it
 * sits in already carries the pulsing dot, and the accent red belongs to the hero's one action.
 * So the number itself is the signal: when it ticks, you see it tick.
 *
 * It is also the Odometer piece from the library, which is the right thing for this site to be
 * using on its own front page.
 *
 * One column per digit, ten digits stacked inside it, moved by a transform. That is a compositor
 * animation and costs no layout, no paint and no measuring — it is a transition on a static
 * stylesheet, not an animation loop.
 */
function Digit({ value, motion }: { value: number; motion: boolean }) {
  return (
    <span aria-hidden className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-baseline">
      <span
        className={cn("absolute inset-x-0 top-0 flex flex-col", motion && "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]")}
        style={{ transform: `translateY(-${value * 10}%)` }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="block h-[1em] leading-[1em]">{i}</span>
        ))}
      </span>
    </span>
  );
}

export function Odometer({ value, className }: { value: number; className?: string }) {
  // First paint lands on the real digits rather than rolling up from zero, which would read as a
  // loading animation. Only later changes roll.
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMotion(true), 50);
    return () => clearTimeout(id);
  }, []);

  const text = new Intl.NumberFormat("en").format(value);
  return (
    <span className={cn("inline-flex h-[1em] leading-none tabular-nums", className)} aria-label={text}>
      {text.split("").map((char, i) =>
        char >= "0" && char <= "9" ? (
          <Digit key={i} value={Number(char)} motion={motion} />
        ) : (
          <span key={i} aria-hidden className="inline-block h-[1em] leading-[1em]">{char}</span>
        ),
      )}
    </span>
  );
}
