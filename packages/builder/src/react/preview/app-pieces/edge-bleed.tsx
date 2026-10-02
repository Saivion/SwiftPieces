"use client";
// Edge to edge, for app pieces that fill the top of a screen (a map, a sky): the piece reaches past
// its stack's padding to the screen edges and, when it is the first thing on the screen, up to the
// top of the content, with the strip under the status bar painted in the piece's own top colour.
// The SwiftUI side does the same with negative padding and .ignoresSafeArea(edges: .top).
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export type Bleed = { style: { marginLeft: number; marginRight: number; marginTop: number }; strip: ReactNode };

export function useEdgeBleed(ref: RefObject<HTMLElement | null>, enabled: boolean, topColor: string): Bleed {
  const [frame, setFrame] = useState<{ l: number; r: number; t: number; screen: HTMLElement | null; bar: number }>({ l: 0, r: 0, t: 0, screen: null, bar: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    const stack = el?.parentElement;
    if (!el || !stack || !enabled) {
      setFrame({ l: 0, r: 0, t: 0, screen: null, bar: 0 });
      return;
    }
    const cs = getComputedStyle(stack);
    const first = stack.firstElementChild === el;
    const screen = first ? el.closest<HTMLElement>(".spb-screen") : null;
    const next = {
      l: parseFloat(cs.paddingLeft || "0"),
      r: parseFloat(cs.paddingRight || "0"),
      t: first ? parseFloat(cs.paddingTop || "0") : 0,
      screen,
      bar: screen ? parseFloat(getComputedStyle(screen).paddingTop || "0") : 0,
    };
    setFrame((f) => (f.l === next.l && f.r === next.r && f.t === next.t && f.screen === next.screen && f.bar === next.bar ? f : next));
  }, [ref, enabled]);
  const strip =
    frame.screen && frame.bar > 0
      ? createPortal(<div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: frame.bar + 1, background: topColor, zIndex: 0, pointerEvents: "none" }} />, frame.screen)
      : null;
  return { style: { marginLeft: -frame.l, marginRight: -frame.r, marginTop: -frame.t }, strip };
}
