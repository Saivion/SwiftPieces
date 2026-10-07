"use client";
import dynamic from "next/dynamic";
import { useCallback, useState, type ReactNode } from "react";
import type { StyleStudioProps } from "./style-studio";

/**
 * The studio runs in the browser only (it reads the address and this browser's last style) and
 * carries the Playground's renderers, so it loads as its own chunk. Until it arrives, the
 * server-rendered shell (studio-shell.tsx) shows the same frame with the real settings in it, so
 * nothing jumps and crawlers read what a style is made of.
 */
const StyleStudio = dynamic(() => import("./style-studio"), { ssr: false });

export function StyleStudioLoader({ children, ...props }: Omit<StyleStudioProps, "onReady"> & { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // The studio mounts hidden and takes the shell's place in one step, once it's drawn.
  return (
    <>
      {ready ? null : children}
      <div hidden={!ready}>
        <StyleStudio {...props} onReady={onReady} />
      </div>
    </>
  );
}
