"use client";
import { useEffect, useState, type ReactNode } from "react";
import { proSession, proSessionHint } from "@/lib/pro-bridge";

/**
 * The App Library's Pro marks for whoever is looking: a Pro owner sees `pro` (Pro apps open for them,
 * so no lock), everyone else, and everyone while the check runs, sees `children`. The last check's
 * hint answers first, so an owner's locks don't flash on every page; it only changes a mark, never access.
 */
export function ProSwap({ pro, children }: { pro: ReactNode; children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    let live = true;
    if (proSessionHint() === "pro") setIsPro(true);
    void proSession().then((s) => live && setIsPro(s === "pro"));
    return () => {
      live = false;
    };
  }, []);
  return <>{isPro ? pro : children}</>;
}
