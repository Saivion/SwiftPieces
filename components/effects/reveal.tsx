"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Props = { children: ReactNode; className?: string; delay?: number; y?: number; once?: boolean; as?: "div" | "section" | "li" | "article" };

/** Fade + rise on enter. Transform/opacity only. */
export function Reveal({ children, className, delay = 0, y = 18, once = true, as = "div" }: Props) {
  const reduced = useReducedMotion();
  const M = motion.create(as);
  return (
    <M
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-8% 0px -8% 0px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </M>
  );
}

/** Staggers direct children. */
export function RevealGroup({ children, className, stagger = 0.07 }: { children: ReactNode; className?: string; stagger?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-8% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}>
      {children}
    </motion.div>
  );
}
