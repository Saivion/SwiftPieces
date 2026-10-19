"use client";
// The App Library header's way into the Pro apps: an outlined tile in the picks' tray that, hovered
// or focused, fills from its corner with the animated Pro halftone every Pro card on the site stands
// on (CornerDither). The field is only there while it shows (mounted on the way in, gone after it
// fades out), so its animation never runs behind a tile nobody is pointing at.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CornerDither } from "@/components/visual/corner-dither";

const FADE_MS = 450;

export function ProUnlock({ href, children }: { href: string; children: ReactNode }) {
  const [field, setField] = useState(false);
  const [lit, setLit] = useState(false);
  const off = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(off.current), []);
  const show = () => {
    window.clearTimeout(off.current);
    setField(true);
    // One frame on the page at opacity 0 first, so the fade in runs.
    requestAnimationFrame(() => requestAnimationFrame(() => setLit(true)));
  };
  const hide = () => {
    setLit(false);
    window.clearTimeout(off.current);
    off.current = window.setTimeout(() => setField(false), FADE_MS);
  };
  return (
    <a href={href} className="frame-pro group relative isolate flex items-center gap-4 rounded-[22px] border border-[var(--line-strong)] px-4 py-4 no-underline sm:px-5" onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide}>
      {field ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit] transition-opacity ease-out" style={{ opacity: lit ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}>
          <CornerDither className="block h-full w-full [mask-image:radial-gradient(55%_170%_at_100%_100%,black_20%,transparent_74%)]" />
        </span>
      ) : null}
      {children}
    </a>
  );
}
