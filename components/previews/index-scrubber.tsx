"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/*
 * Index Scrubber: the A to Z rail beside a contacts list. At rest the rail is quiet letters with the
 * sections that don't exist dimmed. A finger lands on M: the track fades in, the red block pops beside
 * the finger and the list jumps. Dragging down rolls the letter through N, O, P, skips the dimmed Q and
 * holds on S; dragging up rolls back to D; a tap on A returns to rest.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.35, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

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
const rowCenter = (i: number) => COL_TOP + (i + 0.5) * LINE;

type Step = { finger: number | null; list: string; ms: number };
const at = (l: string) => LETTERS.indexOf(l);
/** A finger on entry `l`, with the list wherever that entry lands. */
const on = (l: string, ms: number): Step => ({ finger: at(l), list: LETTERS[resolve(at(l))], ms });
const steps: readonly Step[] = [
  { finger: null, list: "A", ms: 1500 },
  on("M", 750),
  on("N", 170), on("O", 170), on("P", 170), on("Q", 200), on("R", 170), on("S", 950),
  on("P", 130), on("K", 130), on("H", 130), on("F", 130), on("D", 900),
  { finger: null, list: "D", ms: 1200 },
  on("A", 520),
];

export function IndexScrubberPreview() {
  const { step, prev } = useSteps(steps);
  const touching = step.finger !== null;
  const landed = touching ? resolve(step.finger!) : null;
  const last = prev.finger !== null ? resolve(prev.finger) : null;
  // The letter rolls the way the finger travels.
  const down = landed !== null && last !== null ? landed >= last : true;
  const title = landed !== null ? LETTERS[landed] : null;
  const bubbleTop = landed !== null ? Math.min(Math.max(rowCenter(landed) - BUBBLE / 2, 0), BOX_H - BUBBLE) : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes is-roll-down{from{transform:translateY(70%);opacity:0}to{transform:none;opacity:1}}@keyframes is-roll-up{from{transform:translateY(-70%);opacity:0}to{transform:none;opacity:1}}`}</style>
      <div className="relative" style={{ width: u(BOX_W), height: u(BOX_H) }}>
        {/* The list the rail scrolls: section headers and names, jumping without animation like the Swift piece. */}
        <div className="absolute overflow-hidden" style={{ left: 0, top: 0, bottom: 0, right: u(RAIL), WebkitMaskImage: "linear-gradient(to bottom, #000 88%, transparent)", maskImage: "linear-gradient(to bottom, #000 88%, transparent)" }}>
          <div style={{ transform: `translateY(${u(-OFFSETS[step.list])})` }}>
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <div className="flex items-end" style={{ height: u(HEADER), paddingLeft: u(4), fontSize: u(12.5), fontWeight: 700, color: ground.muted }}>{s.title}</div>
                {s.names.map((n) => (
                  <div key={n} className="flex items-center" style={{ height: u(ROW), paddingLeft: u(4), fontSize: u(16.5), whiteSpace: "nowrap" }}>{n}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* The rail: 44 pt hit column, letters centred, the track fading in while touched. */}
        <div className="absolute" style={{ right: 0, top: 0, bottom: 0, width: u(RAIL) }}>
          <div
            data-motion
            className="absolute"
            style={{ right: u(4), top: u(COL_TOP - 6), width: u(TRACK_W), height: u(COL_H + 12), borderRadius: u(TRACK_W / 2), background: ground.field, opacity: touching ? 1 : 0, transition: `opacity .2s ${ease}` }}
          />
          {LETTERS.map((l, i) => {
            const active = landed === i;
            const style: CSSProperties = {
              right: u(4), top: u(COL_TOP + i * LINE), width: u(TRACK_W), height: u(LINE),
              fontSize: u(9.6), fontWeight: 700, lineHeight: 1,
              color: active ? ink : HAS.has(l) ? ground.text : ground.subtle,
              transition: "color .15s",
            };
            return (
              <div key={l} className="absolute flex items-center justify-center" style={style}>
                <span
                  data-motion
                  className="absolute rounded-full"
                  style={{ width: u(16), height: u(16), background: signal.fill, transform: `scale(${active ? 1 : 0.3})`, opacity: active ? 1 : 0, transition: `transform .22s ${spring}, opacity .15s` }}
                />
                <span className="relative">{l}</span>
              </div>
            );
          })}
        </div>

        {/* The letter block beside the finger. */}
        <div
          data-motion
          aria-hidden
          className="absolute flex items-center justify-center overflow-hidden"
          style={{
            right: u(58), top: u(bubbleTop), width: u(BUBBLE), height: u(BUBBLE), borderRadius: u(18),
            background: signal.fill, color: ink, fontSize: u(32), fontWeight: 700, letterSpacing: "-0.01em",
            boxShadow: `0 ${u(8)} ${u(24)} rgba(0,0,0,.18)`,
            opacity: touching ? 1 : 0, transform: `scale(${touching ? 1 : 0.4})`, transformOrigin: "right center",
            transition: `top .24s ${spring}, opacity .2s ${ease}, transform .28s ${touching ? spring : ease}`,
          }}
        >
          {title ? (
            <span key={title} data-motion style={{ display: "block", animation: `${down ? "is-roll-down" : "is-roll-up"} .2s ${ease} both` }}>{title}</span>
          ) : (
            <span>{LETTERS[resolve(prev.finger ?? 0)]}</span>
          )}
        </div>

        {/* The finger. */}
        <span
          aria-hidden
          data-motion
          className="pointer-events-none absolute rounded-full"
          style={{
            right: u(4 + TRACK_W / 2 - 19), top: u(step.finger !== null ? rowCenter(step.finger) - 19 : rowCenter(prev.finger ?? 0) - 19),
            width: u(38), height: u(38), boxSizing: "border-box", border: `${u(1.5)} solid ${ground.muted}`,
            background: "color-mix(in srgb, currentColor 7%, transparent)", opacity: touching ? 0.7 : 0,
            transition: `top .17s ${ease}, opacity .2s ${ease}`,
          }}
        />
      </div>
    </div>
  );
}
