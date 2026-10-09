"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { font, ground } from "./palette";
import { roles, t, type Role, type Spring } from "./piece-motion";
import { Liquid, LiquidGroup, MorphText } from "./piece-liquid";

/*
 * Expandable Text: a paragraph clamped to three lines, set in semibold (600). The end of the last line
 * fades out and a small glass pill reading "more" sits in the faded space, centred on the line. The pill
 * is pressed (the glass swells a little, the label dims), the clip unfurls to the full height (the lines
 * are laid out once, so nothing reflows), and the pill rides the bottom edge down on the same curve to hang
 * under the text, its label morphing letter by letter to "less". Then "less" is pressed: the text tucks back
 * a little quicker, the pill rides back up morphing to "more", and the fade returns a beat into the collapse.
 * The block stays centred, so it grows and shrinks from the middle, like the piece inside a container.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; one iOS point is one px.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** Opening keeps the calm reveal's pace without its give: the edge of text being read never bounces. */
const unfurl: Spring = { duration: roles.reveal.duration, bounce: 0 };
/** Closing is the quicker dismiss. */
const tuckIn: Role = "dismiss";
/** The fade waits until the fold has passed most of the lines below it (about 2/3 into dismiss). */
const RETURN_DELAY = 100;
/** The Swift default link color in dark mode. */
const link = "#ff3b30";
/** The pill, in px: one line of 17px at 1.2 plus 1.5 above and below, 10 either side, at least 44 wide; 4 under the open text. */
const PILL_H = 17 * 1.2 + 3, PILL_GAP = 4;
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

/**
 * Measures the paragraph's full height and one line's height in px, re-measuring when the stage resizes.
 * `armed` is false from each new measurement until a frame has painted it, so the first measurement
 * and width changes place everything at once and only the toggle animates, as in Swift.
 */
function useTextMetrics() {
  const ref = useRef<HTMLParagraphElement>(null);
  const [m, setM] = useState({ full: 0, line: 0 });
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = { full: 0, line: 0 };
    let raf = 0;
    const measure = () => {
      const next = { full: el.scrollHeight, line: parseFloat(getComputedStyle(el).lineHeight) || 0 };
      if (Math.abs(next.full - last.full) < 0.5 && Math.abs(next.line - last.line) < 0.01) return;
      last = next;
      setArmed(false);
      setM(next);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(() => setArmed(true)); });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return { ref, armed, ...m };
}

/** The pill's label box: shared by the pill and the solid block it sits on in the fade, so the two always match. */
const pillBox: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: u(44), padding: `${u(1.5)} ${u(10)}`, fontSize: u(17), lineHeight: 1.2, fontWeight: 600, whiteSpace: "nowrap" };

/** The link as a small neutral glass pill. Pressed, the glass swells about 1.5pt an edge and the label dims. */
function Pill({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <span data-motion className="flex" style={{ transform: `scale(${pressed ? 1.06 : 1})`, transition: t("transform", pressed ? "press" : "release") }}>
      <LiquidGroup unit={u(1)}>
        <Liquid style={{ ...pillBox, color: link }}>
          <span data-motion style={{ display: "inline-flex", opacity: pressed ? 0.45 : 1, transition: t("opacity", pressed ? "press" : "release") }}>
            <MorphText text={label} />
          </span>
        </Liquid>
      </LiquidGroup>
    </span>
  );
}

/** The component alone on the dark ground. */
export function ExpandableTextPreview() {
  const step = useSteps(steps);
  const reduced = useReducedMotion();
  const { ref, armed, full, line } = useTextMetrics();
  const clamped = line * LINES;
  const measured = full > 0 && line > 0;
  const truncated = measured && full > clamped + 0.5;
  const collapsed = truncated && !step.expanded;
  const height = !measured ? undefined : truncated ? (step.expanded ? full : clamped) : full;
  // Only the toggle animates; a measurement lands at once.
  const still = reduced || !armed;
  // The text, the pill and the centring all fold on one curve, so they move as one block.
  const fold = (props: string | string[]) => (still ? "none" : t(props, step.expanded ? unfurl : tuckIn));
  // The fade fills back in as the pill leaves the line, and returns a beat into the collapse.
  const tuck = still ? "none" : collapsed ? t("opacity", "reveal", RETURN_DELAY) : t("opacity", "dismiss");
  // The open pill hangs under the clip, out of flow; lifting by half its room keeps the block centred as it would be
  // with the room in the layout, on the fold's own curve, without animating a second height.
  const lift = truncated && step.expanded ? `translateY(${u(-(PILL_H + PILL_GAP) / 2)})` : "translateY(0px)";
  // The pill rides the bottom edge: centred on the last line while collapsed, a gap under the text when open.
  const pillTop = !truncated ? "0px" : step.expanded ? `calc(${full.toFixed(2)}px + ${u(PILL_GAP)})` : `calc(${(clamped - line / 2).toFixed(2)}px - ${u(PILL_H / 2)})`;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <div data-motion className="relative" style={{ width: u(420), transform: lift, transition: fold("transform") }}>
        {/* numeric-only: the site allows keyword sizes to animate, and the unmeasured auto height must never fold. */}
        <div className="relative w-full" style={{ height, overflow: "hidden", interpolateSize: "numeric-only", transition: fold("height") }}>
          <p
            ref={ref}
            data-motion
            style={{ margin: 0, fontSize: u(17), fontWeight: 600, lineHeight: 1.42, letterSpacing: "-0.01em", ...(measured ? {} : { display: "-webkit-box", WebkitLineClamp: LINES, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}
          >
            {REVIEW}
          </p>
          {/* The fade over the end of the last visible line, solid under the pill. */}
          <div
            aria-hidden
            data-motion
            className="absolute flex items-center"
            style={{ top: clamped - line, insetInlineEnd: 0, height: line, opacity: collapsed ? 1 : 0, transition: tuck, pointerEvents: "none" }}
          >
            <span style={{ width: u(40), height: "100%", background: `linear-gradient(to right, transparent, ${ground.bg})` }} />
            <span style={{ background: ground.bg, height: "100%", display: "flex", alignItems: "center" }}>
              <span style={{ ...pillBox, visibility: "hidden" }}>more</span>
            </span>
          </div>
        </div>
        {/* The pill, out of the clip so it can hang under the open text. */}
        {truncated ? (
          <div data-motion className="absolute" style={{ top: pillTop, insetInlineEnd: 0, transition: fold("top") }}>
            <Pill label={step.expanded ? "less" : "more"} pressed={step.press !== undefined} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
