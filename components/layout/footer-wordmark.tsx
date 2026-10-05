"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";

const SIZE = 158;
/** Figtree's cap height is ~0.7em; the baseline sits a touch lower so the tops never clip. */
const CAP = Math.round(SIZE * 0.76);
const HEIGHT = CAP + 14;
/** "SWIFT" is the empty slot, drawn as a dashed outline; "PIECES" is the piece set into it. */
const SLOT = "SWIFT";
const PIECE = "PIECES";
/** The letter of PIECES the cursor settles on once the word is built. */
const REST = 1;
/** A tailless pointer with its tip at 0,0; the round-joined stroke rounds every corner. */
const POINTER = "M0 0 L5.6 21.5 L9.6 11.2 L19.8 10.6 Z";
/** The middle of a capital's top stroke: cap height is ~0.7em, and at weight 800 the stroke is ~0.14em. */
const INK_Y = CAP - SIZE * 0.7 + SIZE * 0.065;
const WORD: CSSProperties = { fontSize: SIZE, fontWeight: 800, fontFamily: "var(--font-sans)" };

type Point = { x: number; y: number };
/** Where each letter of PIECES starts, and the point on it the cursor clicks. */
type Letter = { x: number; click: Point };
type Marks = { slot: Point; letters: Letter[]; rest: Point };
type Phase = "static" | "waiting" | "playing" | "done";

/** One property of the cursor over time: a value at a moment, eased toward the next key. */
type Key = { t: number; v: number; e: string };
type Tracks = { x: Key[]; y: Key[]; r: Key[]; s: Key[]; o: Key[] };

/** Gentle in-and-out: every move starts and lands softly. */
const SMOOTH = "cubic-bezier(0.45, 0, 0.3, 1)";
/** The rising half of an arc (decelerating to the top) and the falling half (accelerating, then easing down). */
const RISE = "cubic-bezier(0.25, 0.55, 0.4, 1)";
const FALL = "cubic-bezier(0.5, 0, 0.45, 1)";
const PRESS = "cubic-bezier(0.4, 0, 1, 1)";
const RELEASE = "cubic-bezier(0.25, 1.5, 0.45, 1)";

/** How long a hop between letters takes, and how high it rises. */
const HOP = 380;
const HOP_RISE = 30;
/** Press down, then release; the letter is placed at the bottom of the press. */
const PRESS_MS = 90;
const RELEASE_MS = 200;
/** The cursor sets off for the next letter while the release is still springing back, so it never stops dead. */
const LEAVE_AFTER = 170;

/**
 * The cursor's run, one track per property so each moves on its own curve: x glides, y arcs (rise
 * then fall), the lean follows the direction of travel, and the scale presses. Kept apart, a hop is a
 * real curve rather than two straight legs. Returns the tracks and the moments each letter is clicked.
 */
function choreograph(m: Marks) {
  const tr: Tracks = { x: [], y: [], r: [], s: [], o: [] };
  const key = (k: keyof Tracks, t: number, v: number, e = SMOOTH) => tr[k].push({ t, v, e });
  const clicks: number[] = [];

  // In over the empty SWIFT: fades up, sweeps right on a high arc, banking as it turns down onto P.
  const first = m.letters[0].click;
  const enter = 1150;
  key("o", 0, 0, "ease-out");
  key("o", 280, 1);
  key("s", 0, 0.7, "cubic-bezier(0.2, 0.9, 0.3, 1)");
  key("s", 420, 1);
  key("x", 0, m.slot.x + 40);
  key("x", enter, first.x);
  key("y", 0, first.y - 70, RISE);
  key("y", enter * 0.42, first.y - 96, FALL);
  key("y", enter, first.y);
  key("r", 0, -30);
  key("r", enter * 0.55, 12);
  key("r", enter, 0);

  let t = enter;
  m.letters.forEach((l, i) => {
    // Click: press, and the letter lands at the bottom of it.
    key("s", t, 1, PRESS);
    key("s", t + PRESS_MS, 0.82, RELEASE);
    key("s", t + PRESS_MS + RELEASE_MS, 1);
    clicks.push(t + PRESS_MS);

    const next = m.letters[i + 1]?.click;
    if (!next) return;
    // Hop to the next letter: x glides across while y rises and falls, leaning into the move.
    const go = t + LEAVE_AFTER;
    key("x", go, l.click.x);
    key("x", go + HOP, next.x);
    key("y", go, l.click.y, RISE);
    key("y", go + HOP / 2, Math.min(l.click.y, next.y) - HOP_RISE, FALL);
    key("y", go + HOP, next.y);
    key("r", go, 0);
    key("r", go + HOP * 0.45, 9);
    key("r", go + HOP, 0);
    t = go + HOP;
  });

  // Done: a slower arc back to rest, leaning the way it travels, with a small wobble as it settles.
  const last = m.letters[m.letters.length - 1].click;
  const go = t + LEAVE_AFTER + 60;
  const back = 820;
  key("x", go, last.x);
  key("x", go + back, m.rest.x);
  key("y", go, last.y, RISE);
  key("y", go + back * 0.45, Math.min(last.y, m.rest.y) - 46, FALL);
  key("y", go + back, m.rest.y);
  key("r", go, 0);
  key("r", go + back * 0.4, -12);
  key("r", go + back * 0.85, 4);
  key("r", go + back + 240, 0);

  const total = go + back + 240;
  // Each track holds its last value to the end, so every track spans the same timeline.
  const frames = (k: keyof Tracks, css: (v: number) => Keyframe) => {
    const ks = [...tr[k]];
    if (ks[ks.length - 1].t < total) ks.push({ t: total, v: ks[ks.length - 1].v, e: "linear" });
    return ks.map((x) => ({ ...css(x.v), offset: x.t / total, easing: x.e }));
  };
  return {
    total,
    clicks,
    x: frames("x", (v) => ({ transform: `translateX(${v}px)` })),
    y: frames("y", (v) => ({ transform: `translateY(${v}px)` })),
    r: frames("r", (v) => ({ transform: `rotate(${v}deg)` })),
    s: frames("s", (v) => ({ transform: `scale(${v})` })),
    o: frames("o", (v) => ({ opacity: v })),
  };
}

/**
 * The footer's closing wordmark, set like a poster: the word spans the full content width exactly
 * (SVG `textLength`). SWIFT is a dashed outline, the empty slot (the site's dashed frames, in type);
 * PIECES is solid, the part that's been placed. When the footer comes into view a cursor builds it:
 * it swoops in over SWIFT and clicks each letter of PIECES into place, then settles and idles.
 * Pro's footer runs the same piece with its own words (SwiftPiecesPro/components/layout/footer-wordmark.tsx);
 * keep the two in step.
 * Reduced motion shows the finished word with the cursor at rest.
 *
 * Letter positions are read from the rendered text once Figtree has loaded, so every click lands on
 * the real glyph at any width (the viewBox scales; the measurements don't change).
 */
export function FooterWordmark() {
  const svg = useRef<SVGSVGElement>(null);
  const text = useRef<SVGTextElement>(null);
  // The cursor, one nested group per track (x, y, lean, press), then the idle drift.
  const cx = useRef<SVGGElement>(null);
  const cy = useRef<SVGGElement>(null);
  const cr = useRef<SVGGElement>(null);
  const cs = useRef<SVGGElement>(null);
  const drift = useRef<SVGGElement>(null);
  const letters = useRef<(SVGTextElement | null)[]>([]);
  const ripples = useRef<(SVGCircleElement | null)[]>([]);
  const [marks, setMarks] = useState<Marks | null>(null);
  const [phase, setPhase] = useState<Phase>("static");

  // Measure the glyphs once the font is in.
  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => {
      const t = text.current;
      if (!t || !live) return;
      try {
        // Every click lands on ink: the top stroke of each capital (P's bar, I's top, E's arm, the
        // crowns of C and S), which sits just under the cap height at the middle of the glyph.
        const ls = [...PIECE].map((_, i) => {
          const e = t.getExtentOfChar(SLOT.length + i);
          return { x: e.x, click: { x: e.x + e.width * 0.48, y: INK_Y } };
        });
        const slot = t.getExtentOfChar(0);
        const r = ls[REST].click;
        setMarks({ slot: { x: slot.x, y: INK_Y }, letters: ls, rest: { x: r.x + 4, y: r.y + 2 } });
        setPhase(matchMedia("(prefers-reduced-motion: reduce)").matches ? "done" : "waiting");
      } catch {
        // No layout to measure (a hidden footer): the word still shows, solid, without the cursor.
      }
    });
    return () => {
      live = false;
    };
  }, []);

  // The run starts the first time the word is mostly on screen.
  useEffect(() => {
    if (phase !== "waiting") return;
    const el = svg.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setPhase("playing");
      io.disconnect();
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing" || !marks || !cx.current || !cy.current || !cr.current || !cs.current) return;
    const c = choreograph(marks);
    const timing = { duration: c.total, fill: "both" as const };
    const path = cx.current.animate([...c.x], timing);
    // Opacity rides on the x group alongside its transform, as a separate animation.
    const run: Animation[] = [path, cx.current.animate(c.o, timing), cy.current.animate(c.y, timing), cr.current.animate(c.r, timing), cs.current.animate(c.s, timing)];
    const clicks = c.clicks;
    clicks.forEach((delay, i) => {
      const letter = letters.current[i];
      const ripple = ripples.current[i];
      if (letter) {
        run.push(
          letter.animate(
            [
              { opacity: 0, transform: "translateY(16px) scale(0.8)" },
              { opacity: 1, transform: "translateY(-3px) scale(1.035)", offset: 0.5 },
              { opacity: 1, transform: "none" },
            ],
            { duration: 560, delay, easing: "cubic-bezier(0.22, 0.9, 0.3, 1)", fill: "both" },
          ),
        );
      }
      if (ripple) {
        // Starts invisible: with fill "both", the first keyframe also holds through the delay.
        run.push(
          ripple.animate(
            [
              { opacity: 0, transform: "scale(0.2)" },
              { opacity: 0.6, transform: "scale(0.28)", offset: 0.06 },
              { opacity: 0, transform: "scale(1)" },
            ],
            { duration: 560, delay, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "both" },
          ),
        );
      }
    });
    path.onfinish = () => setPhase("done");
    return () => run.forEach((a) => a.cancel());
  }, [phase, marks]);

  // At rest: a slow, small drift and sway, a hand still on the mouse.
  useEffect(() => {
    if (phase !== "done" || !drift.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = drift.current.animate(
      [
        { transform: "translate(0px, 0px) rotate(0deg)" },
        { transform: "translate(3px, -4px) rotate(-5deg)", offset: 0.4 },
        { transform: "translate(-2px, -1px) rotate(3deg)", offset: 0.75 },
        { transform: "translate(0px, 0px) rotate(0deg)" },
      ],
      { duration: 4200, iterations: Infinity, easing: "ease-in-out" },
    );
    return () => a.cancel();
  }, [phase]);

  return (
    <svg ref={svg} aria-hidden viewBox={`0 0 1000 ${HEIGHT}`} overflow="visible" className="footer-mark mt-12 mb-10 block w-full select-none sm:mb-14" data-phase={phase} preserveAspectRatio="xMidYMin meet">
      {/* The whole word in outline: the slot every letter sits in. */}
      <text ref={text} x="0" y={CAP} textLength="1000" lengthAdjust="spacing" className="footer-mark-slot" style={WORD}>
        {SLOT}
        {PIECE}
      </text>
      {marks ? (
        <>
          {/* PIECES, one letter at a time, each placed by a click. */}
          {[...PIECE].map((ch, i) => (
            <text key={i} ref={(el) => void (letters.current[i] = el)} x={marks.letters[i].x} y={CAP} className="footer-mark-letter footer-mark-piece" style={WORD}>
              {ch}
            </text>
          ))}
          {marks.letters.map((l, i) => (
            <circle key={i} ref={(el) => void (ripples.current[i] = el)} cx={l.click.x} cy={l.click.y} r={30} className="footer-mark-ripple" />
          ))}
          {/* The tip sits at the origin of the innermost groups, so lean and press pivot on it. */}
          <g ref={cx} className="footer-mark-cursor" style={phase === "done" ? { transform: `translateX(${marks.rest.x}px)` } : undefined}>
            <g ref={cy} style={phase === "done" ? { transform: `translateY(${marks.rest.y}px)` } : undefined}>
              <g ref={cr}>
                <g ref={cs}>
                  <g ref={drift}>
                    <path d={POINTER} className="footer-mark-rim" />
                    <path d={POINTER} className="footer-mark-pointer" />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </>
      ) : (
        // Before measuring (and without JavaScript): PIECES solid, no cursor.
        <text x="0" y={CAP} textLength="1000" lengthAdjust="spacing" className="footer-mark-piece" style={WORD}>
          <tspan fill="none" stroke="none">{SLOT}</tspan>
          <tspan>{PIECE}</tspan>
        </text>
      )}
    </svg>
  );
}
