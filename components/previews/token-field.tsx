"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink } from "./palette";

/*
 * Token Field: chips wrap across lines while the input takes the rest of the last line.
 * A suggestion is picked, a typed token commits on comma, then backspace highlights and removes the last chip.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const field = "#262626";

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

/** Same stable color pick as `Style.chip(for:)` in Swift: djb2 over the lowercased text. */
const CHIPS = [blocks.sky, blocks.butter, blocks.sage, blocks.lilac, blocks.sand];
function chipColor(text: string) {
  let h = BigInt(5381);
  for (const ch of text.toLowerCase()) h = (h * BigInt(33) + BigInt(ch.codePointAt(0) ?? 0)) & BigInt("0xFFFFFFFFFFFFFFFF");
  return CHIPS[Number(h % BigInt(CHIPS.length))];
}

const SUGGESTIONS = ["Swift", "SwiftData", "SwiftUI", "Combine", "Core Data", "CloudKit", "Figma", "Framer", "Metal", "Accessibility"];
const BASE = ["Swift", "SwiftUI", "Figma"];

type Step = { tokens: string[]; typed: string; sel?: string; removing?: string; pick?: string; ms: number };
const type = (tokens: string[], word: string, every = 150): Step[] =>
  Array.from({ length: word.length }, (_, i) => ({ tokens, typed: word.slice(0, i + 1), ms: every }));

const withCombine = [...BASE, "Combine"];
const withMetal = [...withCombine, "Metal"];
const full = [...withMetal, "Accessibility"];
const steps: readonly Step[] = [
  { tokens: BASE, typed: "", ms: 1300 },
  ...type(BASE, "Co", 220),
  { tokens: BASE, typed: "Co", ms: 700 },
  { tokens: BASE, typed: "Co", pick: "Combine", ms: 220 },
  { tokens: withCombine, typed: "", ms: 700 },
  ...type(withCombine, "Metal"),
  { tokens: withCombine, typed: "Metal,", ms: 90 },
  { tokens: withMetal, typed: "", ms: 600 },
  ...type(withMetal, "Accessibility", 110),
  { tokens: full, typed: "", ms: 1300 },
  { tokens: full, typed: "", sel: "Accessibility", ms: 800 },
  { tokens: full, typed: "", removing: "Accessibility", ms: 380 },
  { tokens: withMetal, typed: "", ms: 1400 },
];

/** Case- and diacritic-insensitive: prefix matches first, then contains; existing tokens left out. */
function matches(query: string, tokens: string[]) {
  const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = fold(query.trim());
  if (!q) return [];
  const have = new Set(tokens.map(fold));
  const pool = SUGGESTIONS.filter((s) => !have.has(fold(s)) && fold(s).includes(q));
  return [...pool.filter((s) => fold(s).startsWith(q)), ...pool.filter((s) => !fold(s).startsWith(q))].slice(0, 5);
}

function Glyph({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

function Chip({ text, selected, removing }: { text: string; selected: boolean; removing: boolean }) {
  const style: CSSProperties = {
    display: "inline-flex", alignItems: "center", height: u(34), paddingLeft: removing ? 0 : u(12), paddingRight: removing ? 0 : u(9), gap: u(8),
    marginInlineEnd: removing ? 0 : u(6), maxWidth: removing ? 0 : u(260), overflow: "hidden", whiteSpace: "nowrap",
    borderRadius: u(12), background: selected ? ground.text : chipColor(text), color: selected ? field : ink,
    fontSize: u(15), fontWeight: 600, opacity: removing ? 0 : 1, transform: `scale(${removing ? 0.5 : selected ? 1.04 : 1})`,
    transformOrigin: "right", animation: `tf-in .4s ${spring} both`,
    transition: `max-width .38s ${ease}, padding .38s ${ease}, margin .38s ${ease}, opacity .25s, transform .3s ${spring}, background-color .2s, color .2s`,
  };
  return <span data-motion style={style}>{text}<Glyph size={11} /></span>;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<b style={{ fontWeight: 700 }}>{text.slice(at, at + query.length)}</b><span style={{ fontWeight: 400 }}>{text.slice(at + query.length)}</span></>;
}

export function TokenFieldPreview() {
  const s = useSteps(steps);
  const list = matches(s.typed, s.tokens);
  const open = list.length > 0;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes tf-in{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}@keyframes tf-caret{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <div style={{ width: u(420), height: u(300), display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="flex flex-wrap items-center" style={{ rowGap: u(6), padding: u(10), minHeight: u(56), borderRadius: u(18), background: field, boxShadow: `inset 0 0 0 ${u(2)} ${ground.text}` }}>
          {s.tokens.map((t) => <Chip key={t} text={t} selected={s.sel === t} removing={s.removing === t} />)}
          <span className="flex items-center" style={{ flex: "1 1 auto", minWidth: u(88), height: u(34), fontSize: u(17), whiteSpace: "nowrap" }}>
            {s.typed ? s.typed : null}
            <span data-motion style={{ width: u(2), height: u(21), marginInline: u(1), background: ground.text, animation: "tf-caret 1s steps(1) infinite" }} />
            {s.typed ? null : <span style={{ color: ground.muted }}>Add skills</span>}
          </span>
        </div>
        <div data-motion className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transform: open ? "none" : `translateY(${u(-6)})`, transition: `grid-template-rows .4s ${ease}, opacity .25s, transform .3s ${ease}` }}>
          <div className="min-h-0 overflow-hidden">
            <div style={{ marginTop: u(8), paddingBlock: u(4), borderRadius: u(16), background: field }}>
              {list.map((m) => (
                <div key={m} className="flex items-center" style={{ height: u(42), gap: u(12), paddingInline: u(16), fontSize: u(16), background: s.pick === m ? "#333333" : "transparent", transition: "background-color .15s" }}>
                  <span className="rounded-full" style={{ width: u(10), height: u(10), background: chipColor(m) }} />
                  <span style={{ fontWeight: 400 }}><Highlight text={m} query={s.typed} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
