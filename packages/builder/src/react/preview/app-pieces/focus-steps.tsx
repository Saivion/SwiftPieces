"use client";
// Focus Steps (definitions/app-pieces/focus-steps.ts): the step in focus in full ink, the rest faded.
// Tap a step to focus it, or swipe up and down to move one step; each move ticks and the list
// scrolls the focused step toward the middle, like ScrollViewReader.scrollTo(anchor: .center).
import { useEffect, useRef } from "react";
import { FOCUS_SIZES, focusSteps } from "../../../definitions/app-pieces/focus-steps.js";
import { b, fillStyle, n, s, useAxis, type Renderer, fw, ts, ACCENT } from "../env.js";
import { useDrag, useLive, useRuntime } from "../runtime.js";
import { EASE_OUT } from "./entrance.js";

export const FocusSteps: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const steps = focusSteps(p.steps);
  const [cur, setCur] = useLive(Math.max(0, Math.min(steps.length - 1, Math.round(n(p, "current")))));
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const root = useRef<HTMLDivElement>(null);
  // The step last scrolled to; comparing against it (not a first-run flag) keeps a remount or a
  // doubled effect from scrolling on open.
  const shown = useRef(-1);
  const size = (FOCUS_SIZES[s(p, "size")] ?? FOCUS_SIZES.large).size;
  const go = (i: number, el: Element | null) => {
    const next = Math.max(0, Math.min(steps.length - 1, i));
    if (next === cur) return;
    rt.haptic("selection", el);
    setCur(next);
  };
  useEffect(() => {
    if (shown.current === -1 || shown.current === cur) {
      shown.current = cur;
      return;
    }
    shown.current = cur;
    const el = refs.current[cur];
    const scroller = root.current?.closest<HTMLElement>(".spb-screen-scroll");
    if (el && scroller) {
      const r = el.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      scroller.scrollBy({ top: r.top + r.height / 2 - (sr.top + sr.height / 2), behavior: "smooth" });
    }
  }, [cur]);
  const onDrag = useDrag({
    axis: "y",
    onEnd: (i) => {
      if (i.dy < -40) go(cur + 1, i.el);
      else if (i.dy > 40) go(cur - 1, i.el);
    },
  });
  const heading = s(p, "heading").trim();
  return (
    <div {...box} className={`${box.className ?? ""} spa-enter`} ref={root} onPointerDown={onDrag} style={{ ...box.style, display: "flex", flexDirection: "column", gap: 36, padding: "24px 0", ...fillStyle(fill, axis), alignSelf: axis === "v" ? "stretch" : undefined }}>
      {heading ? <div style={{ fontSize: ts(22), lineHeight: "28px", fontWeight: fw(600), color: "var(--ios-label3)" }}>{heading}</div> : null}
      {steps.map((t, i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="button"
          aria-selected={i === cur}
          onClick={(e) => go(i, e.currentTarget)}
          style={{
            fontSize: ts(size), lineHeight: `${Math.round(size * 1.62)}px`, color: "var(--ios-label)", cursor: "pointer",
            opacity: i === cur ? 1 : 0.28, transform: i === cur ? "none" : "scale(.97)",
            transition: `opacity .3s ${EASE_OUT}, transform .3s ${EASE_OUT}`, transformOrigin: "left center",
          }}
        >
          {b(p, "numbered") ? <span style={{ color: i === cur && s(p, "marker") !== "plain" ? ACCENT : "var(--ios-label3)", fontWeight: fw(i === cur && s(p, "marker") !== "plain" ? 700 : undefined) }}>{i + 1}&nbsp;&nbsp;</span> : null}
          {t}
        </div>
      ))}
    </div>
  );
};
