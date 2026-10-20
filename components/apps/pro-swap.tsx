"use client";
import { useEffect, useState, type ReactNode } from "react";
import { proSessionHint } from "@/lib/pro-bridge";

/**
 * The Playground's Pro marks for whoever is looking: a Pro owner sees `pro` (Pro apps open for them,
 * so no lock), everyone else sees `children`. It reads only the hint the Playground's own check left
 * (lib/pro-bridge.ts), so the marketing pages it sits on never open the Pro token frame; it only
 * changes a mark, never access.
 */
export function ProSwap({ pro, children }: { pro: ReactNode; children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    setIsPro(proSessionHint() === "pro");
  }, []);
  return <>{isPro ? pro : children}</>;
}
