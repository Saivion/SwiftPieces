"use client";
import dynamic from "next/dynamic";

/**
 * The builder is client-only (its draft lives in this browser) and is the heaviest thing on the
 * site, so it loads as its own chunk after the shell has painted. No other page imports it.
 */
const BuilderApp = dynamic(() => import("./builder-app"), { ssr: false, loading: () => <PlaygroundSkeleton /> });

export function PlaygroundLoader() {
  return <BuilderApp />;
}

/** Same grid as the builder, so nothing jumps when it arrives. */
function PlaygroundSkeleton() {
  return (
    <div className="grid h-[calc(100dvh-var(--nav-h))] min-h-[520px] grid-rows-[52px_1fr]" aria-busy="true" aria-label="Loading the playground">
      <div className="border-b border-[var(--card-border)]" />
      <div className="grid grid-cols-1 lg:grid-cols-[244px_1fr_296px]">
        <div className="hidden border-r border-[var(--card-border)] lg:block" />
        <div className="grid place-items-center">
          <div className="h-[min(640px,70vh)] w-[min(296px,60vw)] rounded-[44px] bg-surface-3 shadow-[0_0_0_8px_#111]" />
        </div>
        <div className="hidden border-l border-[var(--card-border)] lg:block" />
      </div>
    </div>
  );
}
