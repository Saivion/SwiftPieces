"use client";
import { useEffect, useRef, useState } from "react";
import { PreviewFrame } from "@/components/previews/frame";
import { PiecePreview } from "@/components/previews";
import { Parallax, Stage } from "@/components/sections/stage";
import { IPhone } from "@/components/visual/iphone";
import { SkeletonBookingBar, SkeletonField, SkeletonHeader, SkeletonLog, SkeletonNav, SkeletonSection, SkeletonStat, SkeletonStay, SkeletonTask, SkeletonWeek, Slot } from "@/components/visual/skeleton";
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
  { name: "ParallaxCard", title: "Parallax Card", folder: "Cards", ms: 4200 }, // cards.tsx ParallaxCardPreview: scroll to the third walk, press it, settle (4.2 s)
  { name: "LocationPicker", title: "Location Picker", folder: "Inputs", ms: 5300 }, // location-picker.tsx: rest, drag the map, drop, the new street lands (5290)
  { name: "TaskRow", title: "Task Row", folder: "Lists", ms: 5000 }, // lists.tsx TaskRowPreview: complete the first task, then the second, both fold (reopen at 6400)
  { name: "ActivityHeatmap", title: "Activity Heatmap", folder: "Data", ms: 5600 }, // activity-heatmap.tsx: run to today, it fills, the streak rolls, the finger lifts (5200)
  { name: "PagedList", title: "Paged List", folder: "Lists", ms: 5300 }, // paged-list.tsx: scroll, the next page loads, page 3 fails with its Retry chip (5300, before the press)
  { name: "DateRangePicker", title: "Date Range Picker", folder: "Inputs", ms: 4800 }, // date-range-picker.tsx: pick the 12th, then the 24th, the stay holds (4820)
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
      {/* The stage: the piece on show runs on an iPhone rising out of the artboard, in a skeleton of the
          screen it belongs on, and a terminal floats beside it typing the command that installs it. */}
      <Stage
        className="h-[460px] sm:h-[520px]"
        overlay={
          <Parallax depth={18} className="absolute bottom-12 -left-6 z-10 hidden w-[360px] md:block">
            <Terminal key={i} slide={SLIDES[i]} reduced={reduced} />
          </Parallax>
        }
      >
        <div className="absolute inset-x-0 top-10 flex justify-center sm:top-12 md:justify-end md:pr-[12%]">
          <Parallax depth={-7} className="w-[264px] sm:w-[284px]">
            <IPhone>
              {[leaving, i].map((k) =>
                k === null ? null : (
                  <div
                    key={`${k}-${k === i ? "on" : "off"}`}
                    aria-hidden={k !== i}
                    className={cn("absolute inset-0 flex flex-col", k === i ? "piece-in" : "piece-out pointer-events-none")}
                  >
                    <PieceScreen name={SLIDES[k].name} />
                  </div>
                ),
              )}
            </IPhone>
          </Parallax>
        </div>
      </Stage>

      {/* The rail. From sm: one pill track naming every piece, the active pill filling with light over
          the piece's beat, so the tab itself is the progress bar. On phones the names do not fit, so it
          is a stories-style row of hairline segments: pieces already shown stay lit, the current one
          fills, the rest wait dim. Names stay for screen readers, and the install line names the piece. */}
      <div className="mt-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" aria-label="Pieces" className="flex w-full gap-1.5 sm:w-max sm:min-w-full sm:gap-1 sm:rounded-[6px] sm:border sm:border-white/[0.08] sm:bg-white/[0.02] sm:p-1">
          {SLIDES.map((s, k) => {
            const active = k === i;
            const fill = reduced ? undefined : { animation: `piece-progress ${s.ms}ms linear both` };
            return (
              <button
                key={s.name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => show(k)}
                className={cn(
                  "group/tab relative isolate flex h-6 flex-1 items-center justify-center text-[12px] font-medium whitespace-nowrap transition-colors duration-300 sm:h-9 sm:overflow-hidden sm:rounded-[4px] sm:px-3.5",
                  active ? "text-foreground sm:bg-white/[0.06]" : "text-muted hover:text-foreground sm:hover:bg-white/[0.03]",
                )}
              >
                {/* Phones: a 3px segment centred in a 24px tap target. */}
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.14] sm:hidden">
                  {k < i ? <span className="absolute inset-0 bg-white/80" /> : null}
                  {active ? <span key={`${s.name}-${i}`} className="absolute inset-0 origin-left bg-white rtl:origin-right" style={fill} /> : null}
                </span>
                {active ? (
                  <span key={`${s.name}-${i}`} aria-hidden className="absolute inset-0 -z-10 hidden origin-left bg-white/[0.1] rtl:origin-right sm:block" style={fill} />
                ) : null}
                <span className="sr-only sm:not-sr-only">{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 truncate font-sans text-[12.5px] text-muted md:hidden">
        <span className="text-muted">$</span> npx swiftpieces add <span className="text-foreground">{SLIDES[i].name}</span>
      </p>
    </div>
  );
}

/**
 * A terminal window floating on the stage: the install command for the piece on show types itself,
 * then the CLI's lines land one by one. Keyed by the slide, so each piece starts from a clean prompt.
 */
function Terminal({ slide, reduced }: { slide: (typeof SLIDES)[number]; reduced: boolean }) {
  const command = `npx swiftpieces add ${slide.name}`;
  const [typed, setTyped] = useState(reduced ? command.length : 0);
  const done = typed >= command.length;
  useEffect(() => {
    if (reduced || done) return;
    const t = setTimeout(() => setTyped((n) => n + 1), typed === 0 ? 380 : 26);
    return () => clearTimeout(t);
  }, [typed, done, reduced]);

  const line = (delay: number) => (reduced ? undefined : { animationDelay: `${delay}ms` });
  return (
    <div className="stage-dark overflow-hidden rounded-[12px] border border-white/[0.1] bg-[#0c0c0d]/95 text-white shadow-[0_40px_80px_-28px_rgb(0_0_0/0.85),0_12px_28px_-14px_rgb(0_0_0/0.5)] backdrop-blur-md" style={{ rotate: "-2deg" }}>
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-3.5 py-2.5">
        <span className="size-[10px] rounded-full bg-[#ff5f57]" />
        <span className="size-[10px] rounded-full bg-[#febc2e]" />
        <span className="size-[10px] rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[11px] font-medium text-white/45">Terminal · MyApp</span>
      </div>
      <div className="h-[128px] px-4 py-3.5 font-mono text-[12px] leading-[21px]">
        <p className="truncate">
          <span className="text-[#ff8fb8]">~/MyApp</span> <span className="text-white/40">$</span> {command.slice(0, typed)}
          {!done ? <span className="ml-px inline-block h-[13px] w-[7px] translate-y-[2px] bg-white/80" /> : null}
        </p>
        {done ? (
          <>
            <p className="term-line truncate text-white/75" style={line(120)}><span className="text-[#28c840]">✓</span> Added SwiftPieces/{slide.folder}/{slide.name}.swift</p>
            <p className="term-line truncate text-white/75" style={line(320)}><span className="text-[#28c840]">✓</span> No packages, no project changes</p>
            <p className="term-line truncate text-white/40" style={line(520)}>Done. Press ⌘R to run it.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Each piece in a skeleton of the screen it would live on, so it sits where it belongs (a feed of walks,
 * a map under a delivery title, tasks under their filters, receipts loading page by page, a stay picked
 * over its booking bar, a habit's weeks over its session log) and is the one real thing on the phone.
 */
function PieceScreen({ name }: { name: (typeof SLIDES)[number]["name"] }) {
  switch (name) {
    case "ParallaxCard":
      return (
        <>
          <SkeletonHeader />
          <Slot name="ParallaxCard" h={340} aspect="aspect-[3/4]" align="top" className="z-10" />
        </>
      );
    case "LocationPicker":
      // The picker's card runs off the foot of its stage by design, so it runs off the phone's too.
      return (
        <>
          <SkeletonHeader />
          <SkeletonField label={46} className="pb-3" />
          <Slot name="LocationPicker" h={300} scale={1.32} align="top" className="z-10" />
        </>
      );
    case "TaskRow":
      // A planner's Today: the week, today's tasks live, then what is coming up in the same row style.
      return (
        <>
          <SkeletonHeader />
          <SkeletonWeek />
          <SkeletonSection w={40} />
          <Slot name="TaskRow" h={172} scale={1.13} className="z-10" />
          <SkeletonSection w={62} />
          <div className="flex flex-col gap-2">
            <SkeletonTask title="52%" tag />
            <SkeletonTask title="66%" />
          </div>
        </>
      );
    case "PagedList":
      // A receipts screen: the month's spend over the list that loads page by page as it scrolls.
      return (
        <>
          <SkeletonHeader />
          <SkeletonStat />
          <SkeletonSection w={58} />
          {/* Pinned to the top, with a short fade where the rows scroll up under the section label. */}
          <Slot name="PagedList" h={218} scale={1.1} align="top" className="z-10 [mask-image:linear-gradient(to_bottom,transparent,#000_14px)]" />
        </>
      );
    case "DateRangePicker":
      // A stay's booking sheet: the place being booked, its dates picked live, then the total and Reserve.
      return (
        <>
          <SkeletonNav title={84} />
          <SkeletonStay className="pb-1" />
          <Slot name="DateRangePicker" h={236} scale={1.4} className="z-10" />
          <SkeletonBookingBar className="mt-1" />
        </>
      );
    case "ActivityHeatmap":
      // A habit's detail screen: the streak and its weeks live, then the latest sessions logged under it.
      return (
        <>
          <SkeletonNav title={88} className="pb-2" />
          <Slot name="ActivityHeatmap" h={178} scale={1.06} className="z-10" />
          <SkeletonSection w={64} className="pt-3" />
          <SkeletonLog rows={2} />
        </>
      );
  }
}
