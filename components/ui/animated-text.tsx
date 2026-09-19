"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Word-by-word masked reveal for display headings. Accent-wrapped words keep their styling. */
export function AnimatedText({ text, accent, className, as: Tag = "h1", delay = 0 }: { text: string; accent?: string; className?: string; as?: "h1" | "h2" | "p"; delay?: number }) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  const M = motion.create(Tag);
  return (
    <M className={cn("text-balance", className)} aria-label={text}>
      {words.map((w, i) => {
        const isAccent = accent && w.replace(/[.,!?]/g, "") === accent;
        return (
          <span key={i} className="inline-block overflow-hidden py-[0.12em] -my-[0.12em] align-bottom">
            <motion.span
              className={cn("inline-block", isAccent && "text-accent")}
              initial={reduced ? false : { y: "110%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: delay + i * 0.06 }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        );
      })}
    </M>
  );
}
