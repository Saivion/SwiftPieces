"use client";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Whether the element is near the viewport, on a plain IntersectionObserver.
 *
 * This replaces Motion's `useInView`. Motion was being pulled into page bundles for nothing more
 * than visibility checks, and the rest of the library's entrance animations now run in CSS, so
 * importing `motion/react` here would have kept the whole package on the critical path.
 *
 * `once` keeps the value true after the first intersection, matching Motion's option of the same
 * name. Falls back to visible when IntersectionObserver is unavailable, so content is never
 * stranded hidden.
 */
export function useInView<T extends Element>(
  ref: RefObject<T | null>,
  { margin = "0px", once = false }: { margin?: string; once?: boolean } = {},
): boolean {
  const [inView, setInView] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (once && done.current) return;
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) {
          done.current = true;
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, margin, once]);

  return inView;
}
