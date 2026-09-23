"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { font, ground } from "./palette";

/*
 * Expandable Text: a paragraph clamped to three lines. The end of the last line fades out and "more"
 * sits in the faded space; "more" is pressed, the clip grows smoothly to the full height (the lines are
 * laid out once, so nothing reflows), "less" fades in under it, then it collapses back.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
/** The Swift default link color in dark mode. */
const link = "#ff3b30";
const LINES = 3;
const REVIEW =
  "I have tried every planning app on the store and this is the first one I have kept past a month. The weekly view fits on one screen, the widgets actually update, and adding a task from the lock screen takes two taps. Sync between my phone and iPad has been instant, even on hotel Wi-Fi. My only wish is a darker theme for the calendar grid, but that is a small thing next to how calm the whole app feels.";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Walks a scripted list of states; each holds for `ms`, then loops. Holds the first (resting) state under reduced motion. */
function useSteps<T extends { ms: number }>(steps: readonly T[]) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) { setI(0); return; }
    const t = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(t);
  }, [i, steps, reduced]);
  return steps[i];
}

type Step = { ms: number; expanded: boolean; press?: "more" | "less" };
const steps: readonly Step[] = [
  { ms: 1900, expanded: false },
  { ms: 200, expanded: false, press: "more" },
  { ms: 2800, expanded: true },
  { ms: 200, expanded: true, press: "less" },
];

/** Measures the paragraph's full height and one line's height in px, re-measuring when the stage resizes. */
function useTextMetrics() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [m, setM] = useState({ full: 0, line: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setM({ full: el.scrollHeight, line: parseFloat(getComputedStyle(el).lineHeight) || 0 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...m };
}

function Link({ children, pressed, style }: { children: ReactNode; pressed: boolean; style?: CSSProperties }) {
  return (
    <span
      data-motion
      style={{ color: link, fontWeight: 600, paddingInlineStart: u(4), opacity: pressed ? 0.45 : 1, transition: "opacity .16s ease-out", whiteSpace: "nowrap", ...style }}
    >
      {children}
    </span>
  );
}

/** The component alone on the dark ground. */
export function ExpandableTextPreview() {
  const step = useSteps(steps);
  const reduced = useReducedMotion();
  const { ref, full, line } = useTextMetrics();
  const clamped = line * LINES;
  const measured = full > 0 && line > 0;
  const truncated = measured && full > clamped + 0.5;
  const collapsed = truncated && !step.expanded;
  const height = !measured ? undefined : truncated ? (step.expanded ? full : clamped) : full;
  const motion = reduced ? "none" : `height .42s ${ease}`;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <div className="flex flex-col items-end" style={{ width: u(420), gap: u(2) }}>
        <div className="relative w-full" style={{ height, overflow: "hidden", transition: motion }}>
          <p
            ref={ref}
            data-motion
            style={{ margin: 0, fontSize: u(17), lineHeight: 1.42, letterSpacing: "-0.01em", ...(measured ? {} : { display: "-webkit-box", WebkitLineClamp: LINES, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}
          >
            {REVIEW}
          </p>
          {/* The fade over the end of the last visible line, then "more" in the faded space. */}
          <div
            aria-hidden
            data-motion
            className="absolute flex items-center"
            style={{ top: clamped - line, insetInlineEnd: 0, height: line, fontSize: u(17), opacity: collapsed ? 1 : 0, transition: reduced ? "none" : "opacity .25s ease-out", pointerEvents: "none" }}
          >
            <span style={{ width: u(40), height: "100%", background: `linear-gradient(to right, transparent, ${ground.bg})` }} />
            <span style={{ background: ground.bg, height: "100%", display: "flex", alignItems: "center" }}>
              <Link pressed={step.press === "more"}>more</Link>
            </span>
          </div>
        </div>
        <div
          data-motion
          aria-hidden={!step.expanded}
          style={{ fontSize: u(17), lineHeight: 1.42, opacity: truncated && step.expanded ? 1 : 0, transition: reduced ? "none" : "opacity .3s ease-out .12s" }}
        >
          <Link pressed={step.press === "less"}>less</Link>
        </div>
      </div>
    </div>
  );
}
