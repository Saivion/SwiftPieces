"use client";
// Sizing for the studio's Screens view: PhoneFit sizes a phone to the height it's given.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** A phone as tall as its box allows (and no wider than it), for a screen in an iPhone frame. */
export function PhoneFit({ ratio, children }: { ratio: number; children: (width: number) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const b = box.current;
    if (!b) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(Math.min(b.clientWidth, b.clientHeight * ratio))));
    ro.observe(b);
    return () => ro.disconnect();
  }, [ratio]);
  return (
    <div ref={box} className="flex size-full min-h-0 min-w-0 items-center justify-center">
      {width > 0 ? children(width) : null}
    </div>
  );
}
