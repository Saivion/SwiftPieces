"use client";
import { useEffect, useRef, useState } from "react";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { cn } from "@/lib/cn";

/**
 * The CLI row's visual: one piece at a time on a showcase stage, and a rail naming every piece.
 * The active piece plays its first complete beat while its rail tab fills, then the stage crossfades
 * to the next piece, which starts from its first frame (it is keyed, so it remounts). Any tab can be
 * picked directly; the install line under the stage follows the piece on show.
 *
 * `ms` is where that beat ends in each preview's script in components/previews/: keep these in
 * step if a preview's timing changes, or the switch lands mid-gesture.
 */
const SLIDES = [
  { name: "FloatingDock", title: "Floating Dock", ms: 5600 }, // navigation.tsx: select, hover across, settle on tab 4 (4500)
  { name: "CommitButton", title: "Commit Button", ms: 5200 }, // controls.tsx commitSteps: idle → loading → saved
  { name: "FanStack", title: "Fan Stack", ms: 4600 }, // controls.tsx fanSteps: open, hover three, close
  { name: "HoldToConfirm", title: "Hold to Confirm", ms: 5800 }, // controls.tsx holdSteps: short, cancel, hold, done
  { name: "Toast", title: "Toast", ms: 4900 }, // sheets.tsx toastScript: the whole loop
  { name: "ElasticButton", title: "Elastic Button", ms: 4000 }, // controls.tsx elasticSteps: one press, deep and back
] as const;

/** How long the outgoing piece stays mounted while it fades. */
const FADE_MS = 420;

export function PieceCarousel() {
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const fade = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const n = SLIDES.length;

  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);

  // The piece on show, readable from timers and handlers without going stale.
  const current = useRef(0);

  const show = (next: number) => {
    if (next === current.current) return;
    setLeaving(current.current);
    current.current = next;
    setI(next);
    clearTimeout(fade.current);
    fade.current = setTimeout(() => setLeaving(null), FADE_MS);
  };

  // Auto-advance after the active piece's beat. Reduced motion holds on the chosen piece.
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => show((i + 1) % n), SLIDES[i].ms);
    return () => clearTimeout(t);
  }, [i, reduced, n]);

  useEffect(() => () => clearTimeout(fade.current), []);

  return (
    <div>
      {/* The stage: the piece at a fixed, legible size, centred, never cropped by a neighbour. Same height
          as the first row's visual: 400px, or the column's width when that is narrower. */}
      <div className="frame-dashed relative overflow-hidden rounded-[16px]">
        <div className="aspect-square max-h-[400px] w-full" />
        {[leaving, i].map((k) =>
          k === null ? null : (
            <div
              key={`${k}-${k === i ? "on" : "off"}`}
              aria-hidden={k !== i}
              className={cn("absolute inset-0 flex items-center justify-center p-6", k === i ? "piece-in" : "piece-out pointer-events-none")}
            >
              <PreviewFrame tone="clear" aspect="aspect-[4/3]" className="w-full max-w-[440px] rounded-none!">
                <PiecePreview name={SLIDES[k].name} />
              </PreviewFrame>
            </div>
          ),
        )}
      </div>

      {/* The rail: one pill track naming every piece. The active pill fills with light from its leading
          edge over the piece's beat, so the tab itself is the progress bar. */}
      <div className="mt-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" aria-label="Pieces" className="flex w-max min-w-full gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
          {SLIDES.map((s, k) => {
            const active = k === i;
            return (
              <button
                key={s.name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => show(k)}
                className={cn(
                  "relative isolate flex h-9 flex-1 items-center justify-center overflow-hidden rounded-full px-3.5 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-300",
                  active ? "bg-white/[0.06] text-foreground" : "text-subtle hover:bg-white/[0.03] hover:text-muted",
                )}
              >
                {active ? (
                  <span
                    key={`${s.name}-${i}`}
                    aria-hidden
                    className="absolute inset-0 -z-10 origin-left bg-white/[0.1] rtl:origin-right"
                    style={reduced ? undefined : { animation: `piece-progress ${s.ms}ms linear both` }}
                  />
                ) : null}
                {s.title}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 truncate font-mono text-[13px] text-muted">
        <span className="text-subtle">$</span> npx swiftpieces add <span className="text-foreground">{SLIDES[i].name}</span>
      </p>
    </div>
  );
}
