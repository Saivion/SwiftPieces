// The app page's body: the developer's screenshots (reference only), with the ones we remixed
// marked Remix. The Remix button and each marked screenshot open our remix in the Playground, a
// marked screenshot at the screen it inspired. A Pro app's remix is marked Pro: its Playground opens
// for Pro accounts and shows everyone else its screens blurred. The screenshots stay for everyone.
import Link from "next/link";
import type { CSSProperties } from "react";
import { cdn, isProApp, runPath, type LibraryEntry } from "@/lib/apps";
import { FadeImg } from "./fade-img";
import { LockGlyph } from "./pro-chip";
import { ProSwap } from "./pro-swap";
import { AppIdentity, AppStoreLink, ReferenceLabel } from "./reference";

/** The strip takes what the window has left, so the whole page fits without scrolling. */
const STRIP_H = "clamp(360px, calc(100svh - 330px), 680px)";

export function AppDetail({ app: a }: { app: LibraryEntry }) {
  const { store: app, name, screens } = a;
  const live = new Map(screens.map((s) => [s.shot, s]));
  const locked = isProApp(a);
  return (
    <div>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-4">
          <ReferenceLabel app={app} />
          <AppIdentity app={app} name={name} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <AppStoreLink app={app} />
          <Link href={runPath(a)} className="btn-solid inline-flex h-9 items-center gap-2 rounded-[4px] px-4 text-[12.5px] font-semibold">
            {locked ? <ProSwap pro={<RemixGlyph />}><LockGlyph /></ProSwap> : <PlayGlyph />} {screens.length ? `Remix ${screens.length} screens in SwiftUI` : `Remix ${a.pattern.title} in SwiftUI`}
          </Link>
        </div>
      </div>

      <ul className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:thin]" aria-label={`${name} App Store screenshots`}>
        {app.screenshots.map((s, i) => {
          const screen = live.get(i);
          const img = (
            <FadeImg
              src={cdn(s.url, 480)}
              alt={`${name} App Store screenshot ${i + 1} of ${app.screenshots.length}`}
              loading={i < 5 ? "eager" : "lazy"}
              width={s.width}
              height={s.height}
              style={{ height: STRIP_H, width: "auto", aspectRatio: `${s.width} / ${s.height}` }}
              className="rounded-[8px] border border-[var(--card-border)]"
            />
          );
          return (
            <li key={s.url} className="relative flex-none snap-start">
              {screen ? (
                <Link href={runPath(a, screen.shot)} className="group relative block rounded-[8px]" aria-label={`Remix ${screen.title} in SwiftUI${locked ? " (Pro)" : ""}`}>
                  {img}
                  <span className="pointer-events-none absolute inset-0 rounded-[8px] bg-black/0 transition-colors group-hover:bg-black/35" />
                  <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                    {locked ? <ProSwap pro={<span className="size-1.5 rounded-full bg-accent" />}><LockGlyph className="size-2.5" /></ProSwap> : <span className="size-1.5 rounded-full bg-accent" />} {locked ? "Remix · Pro" : "Remix"}
                  </span>
                  <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-black">
                      {locked ? <ProSwap pro={<><RemixGlyph /> Remix in SwiftUI</>}><LockGlyph /> Remix with Pro</ProSwap> : <><PlayGlyph /> Remix in SwiftUI</>}
                    </span>
                  </span>
                </Link>
              ) : (
                img
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Two crossing arrows, the remix mark: what a Pro owner sees where everyone else sees the lock.
 * On hover each arrow redraws from its tail to its head, one after the other (.ai-redraw).
 */
const REMIX_STROKES = ["M4 20 21 3", "M16 3h5v5", "M4 4l5 5", "M15 15l6 6", "M21 16v5h-5"];
function RemixGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="ai size-3 overflow-visible">
      {REMIX_STROKES.map((d, i) => <path key={d} d={d} pathLength={1} className="ai-redraw" style={{ "--i": i } as CSSProperties} />)}
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="ai ai-nudge size-2.5 overflow-visible" style={{ "--ai-x": "2px" } as CSSProperties} fill="currentColor">
      <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.7-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" />
    </svg>
  );
}
