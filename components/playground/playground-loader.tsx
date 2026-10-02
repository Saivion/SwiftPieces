"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Project } from "@swiftpieces/builder";
import { prefetchProBuilds } from "@/lib/pro-apps";
import { proSession, proSessionHint } from "@/lib/pro-bridge";
import type { PlaygroundPage } from "./playground-app";

/**
 * The Playground runs in the browser only (remixes live in this browser) and is the heaviest thing
 * on the site, so it loads as its own chunk. Until it arrives the server-rendered shell shows the
 * same layout with the page's real content, so nothing jumps and crawlers read the page.
 */
const PlaygroundApp = dynamic(() => import("./playground-app"), { ssr: false });

export function PlaygroundLoader({ page, project, children }: { page: PlaygroundPage; project: Project | null; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // Who the visitor is, asked now, while the Playground's chunk downloads. A Pro owner's Pro apps
  // start loading with the check when the last one here said Pro, else as soon as this one does, so
  // a Pro app opens straight from the loading phone and switching to one is instant.
  useEffect(() => {
    const hinted = proSessionHint() === "pro";
    if (hinted) prefetchProBuilds();
    void proSession().then((s) => {
      if (s === "pro" && !hinted) prefetchProBuilds();
    });
  }, []);
  return (
    <>
      {ready ? null : children}
      <PlaygroundApp page={page} project={project} onReady={onReady} />
    </>
  );
}
