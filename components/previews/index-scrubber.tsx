"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { font, ground, ink, signal } from "./palette";
import { curve, follow, rubberBand, t, tiers } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, budStyle, liquid } from "./piece-liquid";

/*
 * Index Scrubber: the A to Z rail beside a contacts list. At rest the rail is a clear glass capsule of quiet
 * letters, with the sections that don't exist dimmed. A finger lands on M: the rail swells a little, a signal
 * glass bead buds out of it under the letter, the letter bubble buds out of the rail beside it a beat behind on a
 * liquid neck, and the list jumps. Dragging down rolls the letter like a counter through N, O, P, skips the dimmed
 * Q and holds on S, the bubble riding a beat behind the bead; the quicker drag back up to D blurs the letter in
 * place instead. A touch on A pulls on past the top, the bubble gives a little, and on release it narrows to a drop
 * and melts back into the rail at its letter, the bead after it.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; one px there is one iOS point.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** The scripted finger dragging on past the end: a hand moving on a clock, not a spring. */
const glide = (ms: number) => `transform ${ms}ms cubic-bezier(0.45, 0, 0.55, 1)`;

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
  return { step: steps[i], prev: steps[(i + steps.length - 1) % steps.length] };
}

const NAMES = [
  "Aiko Tanaka", "Amara Okafor", "Anders Lind", "Beatriz Souza", "Bram de Vries", "Camille Roche", "Chen Wei",
  "Cora Whitfield", "Dalia Haddad", "Dmitri Volkov", "Elena Petrova", "Emeka Obi", "Farah Siddiqui", "Felix Brandt",
  "Grace Holloway", "Hana Kobayashi", "Hugo Marchetti", "Ines Castillo", "Isla Mackenzie", "Jonah Reyes", "Julia Novak",
  "Kofi Mensah", "Leila Farouk", "Liam Gallagher", "Lucia Ferraro", "Mateo Alvarez", "Maya Lindqvist", "Mira Sato",
  "Nadia Rahman", "Noor Aziz", "Oscar Bergman", "Priya Raman", "Rafael Duarte", "Rosa Delgado", "Sofia Esposito",
  "Soren Dahl", "Tariq Nasser", "Uma Iyer", "Vera Lindgren", "Wren Calloway", "Yusuf Demir", "4th Floor Reception",
];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const SECTIONS = LETTERS.map((l) => ({ title: l, names: NAMES.filter((n) => (l === "#" ? !/^\p{L}/u.test(n) : n.startsWith(l))) })).filter((s) => s.names.length);
const HAS = new Set(SECTIONS.map((s) => s.title));

/** Same landing rule as `IndexModel.resolve` in Swift: the entry itself, else the next one with a section, else the previous. */
function resolve(i: number) {
  if (HAS.has(LETTERS[i])) return i;
  for (let k = i + 1; k < LETTERS.length; k++) if (HAS.has(LETTERS[k])) return k;
  for (let k = i - 1; k >= 0; k--) if (HAS.has(LETTERS[k])) return k;
  return i;
}

// List geometry (px at the 560 stage).
const HEADER = 26;
const ROW = 36;
const OFFSETS: Record<string, number> = {};
{
  let y = 0;
  for (const s of SECTIONS) { OFFSETS[s.title] = y; y += HEADER + s.names.length * ROW; }
}

// Rail geometry.
const BOX_W = 400;
const BOX_H = 392;
const RAIL = 44;
const LINE = 13.4;
const COL_H = LETTERS.length * LINE;
const COL_TOP = (BOX_H - COL_H) / 2;
const TRACK_W = 28;
const BUBBLE = 64;
/** The bubble's trailing edge rests a liquid neck's width in from the rail's leading edge. */
const BUBBLE_INSET = 4 + TRACK_W + liquid.joined;
/** The bead under the active letter. */
const BEAD = 16;
/** How much the rail swells either side of the letters while a finger is down. */
const SWELL = 2;
/** The group's width: the rail and the bubble beside it, with room for the bubble's lift. */
const GROUP_W = BUBBLE_INSET + BUBBLE + 24;
const FINGER = 38;
/** How far past an end the bubble can be pulled: Swift's 10 pt at this bubble size, well under a row. */
const BAND = 9.5;
const rowCenter = (i: number) => COL_TOP + (i + 0.5) * LINE;

/** `drag` moves the finger that far past its entry, gliding over `glide` ms. */
type Script = { finger: number | null; drag?: number; glide?: number; list: string; ms: number };
const at = (l: string) => LETTERS.indexOf(l);
/** A finger on entry `l`, with the list wherever that entry lands. */
const on = (l: string, ms: number): Script => ({ finger: at(l), list: LETTERS[resolve(at(l))], ms });
const script: readonly Script[] = [
  { finger: null, list: "A", ms: 1500 },
  on("M", 750),
  on("N", 170), on("O", 170), on("P", 170), on("Q", 200), on("R", 170), on("S", 950),
  on("P", 130), on("K", 130), on("H", 130), on("F", 130), on("D", 900),
  { finger: null, list: "D", ms: 1200 },
  on("A", 420),
  // On past the top: the block gives, the section stays A, nothing scrolls. The finger stops where its ring meets
  // the stage's top edge (14 px above the box), so it is never cropped; the block gives about 3 px against it.
  { ...on("A", 700), drag: -16, glide: 300 },
];

/** A letter in the block: the keyframes it came in on and, once replaced, the ones it leaves on, each with its spring. */
type Run = { name: string; rolls: boolean };
type Letter = { key: string; text: string; enter?: Run; exit?: Run };

/**
 * The letters in the bubble at each step, replaying the piece's `land(on:)`: a new section rolls the letter the way
 * the finger moves, unless it came within 150 ms of the last one or turned back, which blurs it in place. The letter
 * leaving keeps the transition it last had, on the new spring. Its exit plays on a wrapper inside its entrance,
 * which keeps running, so it leaves from wherever it got to and still moving, the way a SwiftUI removal picks up
 * an insertion in flight. It stays mounted until its exit lands, so a quick roll never cuts one off. Run over the
 * loop twice so the letters carried across the wrap are steady.
 */
function letters(steps: readonly Script[]): Letter[][] {
  type Live = Letter & { rolls: boolean; down: boolean; gone?: number };
  let active: number | null = null, down = true, rolls = true, last = -Infinity, now = 0, live: Live[] = [];
  const out: Letter[][] = [];
  for (let pass = 0; pass < 2; pass++) {
    steps.forEach((s, i) => {
      live = live.filter((l) => l.gone === undefined || l.gone > now);
      if (s.finger === null) active = null;
      else {
        const entry = resolve(s.finger);
        // Touch down: the letter comes with the block, which grows out of the rail around it.
        if (active === null) live = [{ key: `${i}`, text: LETTERS[entry], rolls, down }];
        else if (entry !== active) {
          const d = entry > active;
          rolls = d === down && now - last >= 150;
          down = d;
          last = now;
          const leaving = live[live.length - 1];
          leaving.exit = { name: leaving.rolls ? (leaving.down ? "is-out-above" : "is-out-below") : "is-blur-out", rolls };
          leaving.gone = now + letterCurve(rolls).ms;
          live.push({ key: `${i}`, text: LETTERS[entry], rolls, down, enter: { name: rolls ? (down ? "is-in-below" : "is-in-above") : "is-blur-in", rolls } });
        }
        active = entry;
      }
      out[i] = live.map(({ key, text, enter, exit }) => ({ key, text, enter, exit }));
      now += s.ms;
    });
  }
  return out;
}
/** The letter is a readout, so it rolls without overshoot like a counter, or blurs in place on the tight spring. */
const letterCurve = (rolls: boolean) => curve(rolls ? "value" : tiers.tight);
const run = (r?: Run) => r && `${r.name} ${letterCurve(r.rolls).ms}ms ${letterCurve(r.rolls).easing} both`;
const LETTER_STEPS = letters(script);
const steps: readonly (Script & { letters: Letter[] })[] = script.map((s, i) => ({ ...s, letters: LETTER_STEPS[i] }));

const fingerY = (s: Script) => rowCenter(s.finger ?? 0) + (s.drag ?? 0);
/** Past either end of the column the bubble follows the finger with rubber-band resistance; the entry stays put. */
function pullOf(s: Script) {
  if (s.finger === null) return 0;
  const y = fingerY(s);
  return rubberBand(y < COL_TOP ? y - COL_TOP : Math.max(y - (COL_TOP + COL_H), 0), BAND);
}

export function IndexScrubberPreview() {
  const { step, prev } = useSteps(steps);
  const touching = step.finger !== null;
  const wasTouching = prev.finger !== null;
  const landed = touching ? resolve(step.finger!) : null;
  // At rest the bead and the bubble stay on their last letter, so they melt back into the rail there.
  const shown = landed ?? resolve(prev.finger ?? 0);
  const title = LETTERS[shown];
  const place = Math.min(Math.max(rowCenter(shown) - BUBBLE / 2, 0), BOX_H - BUBBLE);
  const pull = pullOf(step);
  // The finger, and the pull that tracks it, move on the touch's own clock; a fresh touch lands without travelling.
  const fingerMove = !touching || !wasTouching ? "transform 0ms" : step.glide ? glide(step.glide) : t("transform", "press");
  // Out while a finger is down. Home, the bubble is a drop in the middle of the rail at its letter: across the neck,
  // then up or down to the letter when it was held inside the rail's ends, shrunk to a size the rail can hold.
  const out = touching;
  const home: [number, number] = [liquid.joined + BUBBLE / 2 + TRACK_W / 2, rowCenter(shown) - place - BUBBLE / 2];
  const bubble = budStyle({ out, home }, u(1));
  const drop = out ? "" : ` scale(${TRACK_W / BUBBLE})`;

  const swell = touching ? SWELL : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes is-in-below{from{transform:translateY(100%);opacity:0;filter:blur(3px)}}@keyframes is-in-above{from{transform:translateY(-100%);opacity:0;filter:blur(3px)}}@keyframes is-out-above{to{transform:translateY(-100%);opacity:0;filter:blur(3px)}}@keyframes is-out-below{to{transform:translateY(100%);opacity:0;filter:blur(3px)}}@keyframes is-blur-in{from{opacity:0;filter:blur(6px);transform:scale(.8)}}@keyframes is-blur-out{to{opacity:0;filter:blur(6px);transform:scale(.8)}}`}</style>
      <div className="relative" style={{ width: u(BOX_W), height: u(BOX_H) }}>
        {/* The list the rail scrolls: section headers and names, jumping without animation like the Swift piece. */}
        <div className="absolute overflow-hidden" style={{ left: 0, top: 0, bottom: 0, right: u(RAIL), WebkitMaskImage: "linear-gradient(to bottom, #000 88%, transparent)", maskImage: "linear-gradient(to bottom, #000 88%, transparent)" }}>
          <div style={{ transform: `translateY(${u(-OFFSETS[step.list])})` }}>
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <div className="flex items-end" style={{ height: u(HEADER), paddingLeft: u(4), fontSize: u(12.5), fontWeight: 600, color: ground.muted }}>{s.title}</div>
                {s.names.map((n) => (
                  <div key={n} className="flex items-center" style={{ height: u(ROW), paddingLeft: u(4), fontSize: u(16.5), whiteSpace: "nowrap" }}>{n}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* The glass: the rail, the bead and the letter bubble, one liquid. Every shape is placed from the top and the
            trailing edge, so both of the group's passes put it in the same place. */}
        <div className="absolute" style={{ right: 0, top: 0, width: u(GROUP_W), height: u(BOX_H) }}>
        <LiquidGroup unit={u(1)} axis="x">
          <div className="relative" style={{ width: u(GROUP_W), height: u(BOX_H) }}>
            {/* The letter bubble, under the rail so it melts in behind the letters. It rides a beat behind the bead. */}
            <div data-motion className="absolute" style={{ right: u(BUBBLE_INSET), top: 0, width: u(BUBBLE), height: u(BUBBLE), transform: `translateY(${u(place)})`, transition: touching && wasTouching ? t("transform", follow(tiers.tight, 1)) : "none" }}>
              {/* Past an end it gives with the finger; on release it draws back to its letter as it melts. */}
              <div data-motion className="absolute inset-0" style={{ transform: `translateY(${u(pull)})`, transition: touching ? fingerMove : t("transform", "dismiss") }}>
                {/* The bud's own transform with one more shrink on the way home, to a drop the rail can hold, so this
                    bubble places itself rather than through `bud`. */}
                <Liquid tint={out ? signal.fill : undefined} className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{
                  ...bubble, transform: `${bubble.transform}${drop}`,
                  transition: [bubble.transition, t("background-color", out ? liquid.split : liquid.home)].join(", "),
                  color: ink, fontSize: u(32), fontWeight: 600, letterSpacing: "-0.01em",
                }}>
                  <BudContent out={out}>
                    <span className="relative block" style={{ lineHeight: 1.2 }}>
                      <span className="invisible block">{title}</span>
                      {/* Stable keys keep each entrance running untouched while its exit plays inside it. */}
                      {step.letters.map((l) => (
                        <span key={l.key} data-motion className="absolute inset-0 flex justify-center" style={{ whiteSpace: "nowrap", animation: run(l.enter) }}>
                          <span data-motion style={{ animation: run(l.exit) }}>{l.text}</span>
                        </span>
                      ))}
                    </span>
                  </BudContent>
                </Liquid>
              </div>
            </div>

            {/* The rail: a clear glass capsule carrying the letters, swelling a little either side of them while touched. */}
            <Liquid className="absolute" style={{
              right: u(4 - swell), top: u(COL_TOP - 6), width: u(TRACK_W + swell * 2), height: u(COL_H + 12),
              transition: t(["right", "width"], touching ? "press" : "dismiss"),
            }}>
              {LETTERS.map((l, i) => {
                const active = landed === i;
                // The ink turns as the bead glides in and back as it glides out, on the bead's own spring.
                const style: CSSProperties = {
                  left: 0, right: 0, top: u(6 + i * LINE), height: u(LINE),
                  fontSize: u(9.6), fontWeight: 600, lineHeight: 1,
                  color: active ? ink : HAS.has(l) ? ground.text : ground.subtle,
                  transition: t("color", touching ? "snap" : "dismiss"),
                };
                return <div key={l} className="absolute flex items-center justify-center" style={style}>{l}</div>;
              })}
            </Liquid>

            {/* The bead: signal glass over the rail under the active letter. It buds out of the rail where the finger
                lands, glides from letter to letter on the snap spring, and melts back in on release. */}
            <div data-motion className="absolute" style={{ right: u(4 + TRACK_W / 2 - BEAD / 2), top: 0, width: u(BEAD), height: u(BEAD), transform: `translateY(${u(rowCenter(shown) - BEAD / 2)})`, transition: touching && wasTouching ? t("transform", "snap") : "none" }}>
              {/* It buds in place: it is already inside the rail, so home is where it rests. */}
              <Liquid tint={out ? signal.fill : undefined} bud={{ out, home: [0, 0] }} className="absolute inset-0" style={{ transition: t("background-color", out ? liquid.split : liquid.home) }} />
            </div>
          </div>
        </LiquidGroup>
        </div>

        {/* The finger. */}
        <span
          aria-hidden
          data-motion
          className="pointer-events-none absolute rounded-full"
          style={{
            right: u(4 + TRACK_W / 2 - FINGER / 2), top: 0,
            width: u(FINGER), height: u(FINGER), boxSizing: "border-box", border: `${u(1.5)} solid ${ground.muted}`,
            background: "color-mix(in srgb, currentColor 7%, transparent)", opacity: touching ? 0.7 : 0,
            transform: `translateY(${u(fingerY(touching ? step : prev) - FINGER / 2)})`,
            transition: `${fingerMove}, ${t("opacity", touching ? "press" : "dismiss")}`,
          }}
        />
      </div>
    </div>
  );
}
