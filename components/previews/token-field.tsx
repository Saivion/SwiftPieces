"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { font, ground, ink, signal } from "./palette";
import { curve, ms, pressScale, t, type Role } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, liquid } from "./piece-liquid";

/*
 * Token Field, in liquid glass as the Swift piece draws it: the input is a glass capsule and every token a glass chip
 * beside it, resting apart in a wrapping flow, with the input taking the rest of the last line. A suggestion is picked,
 * a typed token commits on comma, then backspace highlights the last chip and a second press melts it back into the
 * input. Each new chip buds out of the input under the text it was typed as; the suggestion list buds out of the input
 * too and rests apart below the field.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`. The flow is laid out here, as the
 * Swift `FlowLayout` lays it out, with widths estimated from text length, so both glass passes place every shape alike.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const FIELD_W = 420, STAGE_H = 300, PILL_H = 40, MIN_INPUT = 88, ROW = 42, PANEL_PAD = 4;
const GAP = liquid.apart;
const PLACEHOLDER = "Add skills";

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
  return { step: steps[i], prev: steps[(i - 1 + steps.length) % steps.length] };
}

const SUGGESTIONS = ["Swift", "SwiftData", "SwiftUI", "Combine", "Core Data", "CloudKit", "Figma", "Framer", "Metal", "Accessibility"];
const BASE = ["Swift", "SwiftUI", "Figma"];

/** `removing` chips leave the flow at once and melt into the input from where they were, while the rest reflow. */
type Step = { tokens: string[]; typed: string; sel?: string; removing?: string[]; pick?: string; ms: number };
const type = (tokens: string[], word: string, every = 150): Step[] =>
  Array.from({ length: word.length }, (_, i) => ({ tokens, typed: word.slice(0, i + 1), ms: every }));

/** Long enough for a melt to reach home before the chip is gone. */
const MELT_MS = ms(liquid.home);
const withCombine = [...BASE, "Combine"];
const withMetal = [...withCombine, "Metal"];
const full = [...withMetal, "Accessibility"];
const steps: readonly Step[] = [
  { tokens: BASE, typed: "", ms: 1300 },
  ...type(BASE, "Co", 220),
  { tokens: BASE, typed: "Co", ms: 700 },
  { tokens: BASE, typed: "Co", pick: "Combine", ms: 220 },
  { tokens: withCombine, typed: "", ms: 900 },
  ...type(withCombine, "Metal"),
  { tokens: withCombine, typed: "Metal,", ms: 90 },
  { tokens: withMetal, typed: "", ms: 800 },
  ...type(withMetal, "Accessibility", 110),
  { tokens: full, typed: "", ms: 1300 },
  { tokens: full, typed: "", sel: "Accessibility", ms: 800 },
  { tokens: full, typed: "", sel: "Accessibility", removing: ["Accessibility"], ms: MELT_MS },
  { tokens: withMetal, typed: "", ms: 1400 },
  // The loop resets the way Swift's scene does: both added chips melt home in one change.
  { tokens: withMetal, typed: "", removing: ["Combine", "Metal"], ms: MELT_MS },
];

/** Case- and diacritic-insensitive: prefix matches first, then contains; existing tokens left out. */
function matches(query: string, tokens: string[]) {
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = fold(query.trim());
  if (!q || q.includes(",")) return [];
  const have = new Set(tokens.map(fold));
  const pool = SUGGESTIONS.filter((s) => !have.has(fold(s)) && fold(s).includes(q));
  return [...pool.filter((s) => fold(s).startsWith(q)), ...pool.filter((s) => !fold(s).startsWith(q))].slice(0, 5);
}

/** Text widths at semibold, estimated per character. */
const textW = (s: string, size: number) => s.length * size * 0.56;
const chipW = (text: string) => Math.round(14 + textW(text, 15) + 32);

type Box = { x: number; y: number; w: number };
/** The Swift `FlowLayout`: leading-aligned rows resting apart, the input taking the rest of the last line, or a new one. */
function flow(tokens: string[], typed: string) {
  let x = 0, y = 0;
  const chips = new Map<string, Box>();
  for (const k of tokens) {
    const w = chipW(k);
    if (x > 0 && x + w > FIELD_W) { x = 0; y += PILL_H + GAP; }
    chips.set(k, { x, y, w });
    x += w + GAP;
  }
  const need = Math.max(MIN_INPUT, textW(typed || PLACEHOLDER, 17) + 40);
  if (x > 0 && x + need > FIELD_W) { x = 0; y += PILL_H + GAP; }
  return { chips, input: { x, y, w: FIELD_W - x }, height: y + PILL_H };
}
const layoutOf = (s: Step) => flow(s.tokens.filter((k) => !s.removing?.includes(k)), s.typed);
/** Where text typed into the input sits: its middle, inside the input's leading padding. */
const typedCenter = (input: Box, typed: string): [number, number] => [input.x + 16 + Math.min(textW(typed.replace(",", ""), 17), input.w - 32) / 2, input.y + PILL_H / 2];

const panelH = (rows: number) => rows * ROW + PANEL_PAD * 2;
/** The loop's longest list. The stage re-centres for it whenever the list is open, so refining the rows never moves the field. */
const OPEN_ROWS = Math.max(...steps.map((s) => matches(s.typed, s.tokens).length));

function Cross({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

function Plus({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

/** The matched run in full ink, the rest of the candidate quieter. */
function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{text}</>;
  return <><span style={{ color: ground.muted }}>{text.slice(0, at)}</span>{text.slice(at, at + query.length)}<span style={{ color: ground.muted }}>{text.slice(at + query.length)}</span></>;
}

const budKeyframes = (() => {
  const split = curve(liquid.split);
  return {
    css: "@keyframes tf-bud{from{transform:translate(var(--tf-hx),var(--tf-hy)) scale(.72)}to{transform:none}}@keyframes tf-bud-in{from{opacity:0;filter:blur(6px)}to{opacity:1;filter:none}}@keyframes tf-caret{0%,49%{opacity:1}50%,100%{opacity:0}}",
    // A chip buds out on the split spring; its label arrives just after it leaves.
    bud: `tf-bud ${split.ms}ms ${split.easing} backwards`,
    label: "tf-bud-in 300ms ease-out 100ms backwards",
  };
})();

/**
 * One glass chip. Born (`home` set) it buds out of the input from under the text it was typed as; melting (`melt`
 * set) it heads into the input's leading end on the bounceless spring, its tint and label going first.
 */
function Chip({ text, box, selected, home, melt }: { text: string; box: Box; selected: boolean; home?: [number, number]; melt?: [number, number] }) {
  const out = !melt;
  const tinted = selected && out;
  const style: CSSProperties = {
    width: u(box.w), height: u(PILL_H), paddingLeft: u(14), paddingRight: u(4),
    color: tinted ? ink : ground.text, fontSize: u(15), fontWeight: 600, whiteSpace: "nowrap",
    ...(home ? { "--tf-hx": u(home[0]), "--tf-hy": u(home[1]), animation: budKeyframes.bud } as CSSProperties : null),
    transform: melt ? `translate(${u(melt[0])}, ${u(melt[1])}) scale(${liquid.homeScale})` : undefined,
    transition: [melt ? t("transform", liquid.home) : null, t(["background-color", "color"], "snap")].filter(Boolean).join(", "),
  };
  return (
    // A highlighted chip lifts 4% and snaps, as it answers a key.
    <span data-motion className="absolute left-0 top-0 block" style={{ transform: `translate(${u(box.x)}, ${u(box.y)})`, transition: melt ? undefined : t("transform", "snap") }}>
      <span data-motion className="block" style={{ transform: `scale(${selected && out ? 1.04 : 1})`, transition: t("transform", "snap") }}>
        <Liquid tint={tinted ? signal.fill : undefined} className="flex items-center" style={style}>
          <BudContent out={out}>
            <span className="flex items-center" style={{ animation: home ? budKeyframes.label : undefined }}>
              {text}<span className="flex justify-center" style={{ width: u(28) }}><Cross size={11} /></span>
            </span>
          </BudContent>
        </Liquid>
      </span>
    </span>
  );
}

export function TokenFieldPreview() {
  const { step: s, prev } = useSteps(steps);
  const list = matches(s.typed, s.tokens);
  const open = list.length > 0;
  // The list keeps its last rows while it melts home.
  const lastRows = useRef<string[]>([]), lastQuery = useRef("");
  useEffect(() => { if (open) { lastRows.current = list; lastQuery.current = s.typed; } });
  const rows = open ? list : lastRows.current;
  const query = open ? s.typed : lastQuery.current;
  // Chips already there when the stage mounts are at rest; only chips added later bud.
  const born = useRef<Set<string> | null>(null);
  if (born.current === null) born.current = new Set(s.tokens);

  const now = layoutOf(s), before = layoutOf(prev);
  const removing = new Set(s.removing ?? []);
  const fieldH = now.height;
  const room = GAP + panelH(OPEN_ROWS);
  // Field and list stay centred together: the list hangs under the field, and the whole moves up by half of it.
  const top = (STAGE_H - fieldH - (open ? room : 0)) / 2;
  const listRole: Role = open ? "snap" : "dismiss";

  // The list buds out of the input: home is its centre on the input's, shrunk until it fits inside it.
  const ph = panelH(Math.max(rows.length, 1));
  const listTop = fieldH + GAP;
  const fit = Math.min(1, (now.input.w * 0.8) / (FIELD_W * liquid.homeScale), (PILL_H * 0.8) / (ph * liquid.homeScale));
  const listHome: [number, number] = [now.input.x + now.input.w / 2 - FIELD_W / 2, now.input.y + PILL_H / 2 - (listTop + ph / 2)];
  const press = pressScale(FIELD_W, ROW, 1.5);

  const chip = (k: string): ReactNode => {
    const melting = removing.has(k);
    const box = melting ? before.chips.get(k) : now.chips.get(k);
    if (!box) return null;
    // New this step: born under the text it was typed as, where the input was a moment ago.
    const isNew = !prev.tokens.includes(k) && !born.current?.has(k);
    const birth = isNew ? typedCenter(before.input, prev.typed || k.slice(0, 2)) : undefined;
    // Under that text, but shrunk inside the input's ends, so a long chip from a short query never pokes out.
    const half = (box.w * liquid.homeScale) / 2 + 2;
    const bornX = birth ? Math.min(Math.max(birth[0], before.input.x + half), before.input.x + before.input.w - half) : 0;
    const home = birth ? [bornX - (box.x + box.w / 2), birth[1] - (box.y + PILL_H / 2)] as [number, number] : undefined;
    // Melting: into the input's leading end, where it now sits.
    const into = melting ? [now.input.x + (box.w * liquid.homeScale) / 2 + 4 - (box.x + box.w / 2), now.input.y - box.y] as [number, number] : undefined;
    return <Chip key={k} text={k} box={box} selected={s.sel === k} home={home} melt={into} />;
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{budKeyframes.css}</style>
      <div className="relative" style={{ width: u(FIELD_W), height: u(STAGE_H) }}>
        <div data-motion className="absolute inset-x-0 top-0" style={{ transform: `translateY(${u(top)})`, transition: t("transform", listRole) }}>
          <LiquidGroup unit={u(1)} axis="both" style={{ width: u(FIELD_W), height: u(fieldH) }}>
            {/* Under the input, so at home it sits inside it. Refining the rows changes its height on `value`, which
                never overshoots; its rows are text being read. */}
            <span className="absolute left-0" style={{ top: u(listTop), width: u(FIELD_W) }}>
              <Liquid radius={18} className="block overflow-hidden" style={{
                height: u(ph), paddingBlock: u(PANEL_PAD),
                transform: open ? "none" : `translate(${u(listHome[0])}, ${u(listHome[1])}) scale(${liquid.homeScale * fit})`,
                transition: [t("transform", open ? liquid.split : liquid.home), t("height", "value")].join(", "),
              }}>
                <BudContent out={open} className="block">
                  <span className="flex flex-col" style={{ width: u(FIELD_W) }}>
                    {rows.map((m) => {
                      const picked = s.pick === m;
                      return (
                        <span key={m} className="flex items-center" style={{ height: u(ROW), gap: u(12), paddingInline: u(16), fontSize: u(16), fontWeight: 600, background: picked ? ground.control : "transparent", transform: picked ? `scale(${press})` : "none", transition: t(["transform", "background-color"], picked ? "press" : "release") }}>
                          <span className="flex" style={{ width: u(10), color: ground.muted }}><Plus size={12} /></span>
                          <span><Highlight text={m} query={query} /></span>
                        </span>
                      );
                    })}
                  </span>
                </BudContent>
              </Liquid>
            </span>
            {/* Melting chips first, so they slip under the chips they cross and end under the input. */}
            {s.tokens.filter((k) => removing.has(k)).map(chip)}
            {s.tokens.filter((k) => !removing.has(k)).map(chip)}
            {/* The input: a glass capsule taking the rest of the last line. Only a commit or a removal moves it. */}
            <span data-motion className="absolute left-0 top-0 block" style={{ transform: `translate(${u(now.input.x)}, ${u(now.input.y)})`, transition: t("transform", "snap") }}>
              <Liquid className="relative flex items-center" style={{ width: u(now.input.w), height: u(PILL_H), paddingInline: u(16), fontSize: u(17), fontWeight: 600, whiteSpace: "nowrap", transition: t("width", "snap") }}>
                {s.typed ? s.typed : null}
                <span data-motion style={{ width: u(2), height: u(21), marginInline: u(1), background: ground.text, animation: "tf-caret 1s steps(1) infinite" }} />
                {s.typed ? null : <span style={{ color: ground.muted }}>{PLACEHOLDER}</span>}
                {/* The focus ring, a few points in from the edge so a budding chip's neck never cuts it. */}
                <span className="pointer-events-none absolute rounded-full" style={{ inset: u(3), boxShadow: `inset 0 0 0 ${u(2)} ${ground.text}` }} />
              </Liquid>
            </span>
          </LiquidGroup>
        </div>
      </div>
    </div>
  );
}
