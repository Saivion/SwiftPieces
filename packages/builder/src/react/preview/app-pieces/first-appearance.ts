"use client";
// Entrances play once, on a piece's first appearance. SwiftUI keeps a pushed-from screen's @State
// alive, so coming back (or a sheet's content re-rendering as it slides away) never replays an
// entrance there; the preview remounts screens, so it remembers which nodes have already entered.
import { useEffect, useState } from "react";

const entered = new Set<string>();

/** False on a node's very first render (so its entrance can play), true once it has appeared. */
export function useFirstAppearance(id: string | undefined, delay = 30): boolean {
  const seen = !!id && entered.has(id);
  const [appeared, setAppeared] = useState(seen);
  useEffect(() => {
    if (appeared) return;
    const t = window.setTimeout(() => {
      if (id) entered.add(id);
      setAppeared(true);
    }, delay);
    return () => window.clearTimeout(t);
  }, [appeared, id, delay]);
  return appeared;
}
