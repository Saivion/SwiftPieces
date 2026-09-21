"use client";
import { useEffect, useState } from "react";

/**
 * Whether the visitor has asked for reduced motion.
 *
 * Replaces Motion's `useReducedMotion`. The entrance animations moved to CSS, where the media
 * query is handled directly, so the only remaining callers are the few components that animate a
 * value in JavaScript. Importing `motion/react` for this one boolean kept the package on the
 * critical path of pages that otherwise need none of it.
 *
 * Starts false so the server and the first client render agree, then corrects on mount.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
