"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { blocks, font, ground, ink, signal } from "./palette";
import { curve, ms, pressScale, reduced, t } from "./piece-motion";
import { BudContent, Liquid, LiquidGroup, budStyle, liquid } from "./piece-liquid";

/*
 * Address Field, as the liquid glass piece: a query is typed and the clear bubble buds out of the field's end; after
 * the debounce it spins while suggestions load, then the glass list pours down out of the field and rests apart from
 * it, the match picked out in the label colour. One is picked (its row sinks a point), a spinner bubble buds out of
 * the list beside it while the address resolves, then the bubbles and the list melt back into the field as the street
 * and locality settle in and the sage check lands. The loop then clears the address as the Swift demo does, so the
 * field settles back on `morph`. Motion follows AddressField.swift 1.2.0 through piece-motion and piece-liquid.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`; one px there is one iOS point.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
/** A dense 418 x 56 row sinks about a point (`piecePress(depth: 1)`), so the list stays steady under the finger. */
const ROW_PRESS = pressScale(418, 56, 1);
/** The field's height at rest, and the diameter of the bubbles beside the field and the list. */
const H = 56;
const gap = liquid.joined;
/** The column a bubble holds beside the field and the list while it is out. */
const COLUMN = H + gap;
const ROW = 56;
/** The list's padding around its rows. */
const PAD = 6;
/** The sliver the list is born as, tucked inside the field's bottom edge. */
const SLIVER = 28;
/** From its place, apart below the field, up to its home just inside the field's bottom edge. */
const LIST_HOME = liquid.apart + SLIVER / 2 + (SLIVER * liquid.homeScale) / 2 + 4;
/** A bubble's home just inside its parent's end, when another bubble already holds the column open. */
const TUCKED = -(H / 2 + gap + (H * liquid.homeScale) / 2);
/** The same, when the parent's edge is about to pull back from full width. */
const AT_EDGE = (H * (1 - liquid.homeScale)) / 2;

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
  const still = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (still) { setI(0); return; }
    const id = setTimeout(() => setI((v) => (v + 1) % steps.length), steps[i].ms);
    return () => clearTimeout(id);
  }, [i, steps, still]);
  return steps[i];
}

const SUGGESTIONS = [
  { title: "48 Juniper Lane", subtitle: "Bellmont, OR, United States" },
  { title: "48 Juniper Court", subtitle: "Ashford, WA, United States" },
  { title: "48 Junipero Street", subtitle: "Alder Bay, CA, United States" },
  { title: "48 Juniper Row", subtitle: "Harlow, ON, Canada" },
];
const QUERY = "48 Juni";
const LIST_H = PAD * 2 + SUGGESTIONS.length * ROW;

type Step = {
  typed: string;
  focused: boolean;
  /** Suggestions are on screen. */
  list?: boolean;
  loading?: boolean;
  pressed?: number;
  resolving?: number;
  resolved?: boolean;
  /** The address was just cleared: the check and locality are going. */
  clearing?: boolean;
  ms: number;
};

// Typing is never animated or delayed. Each keystroke restarts the 250ms debounce, so the search starts once typing pauses.
const typing: Step[] = Array.from({ length: QUERY.length }, (_, i) => ({ typed: QUERY.slice(0, i + 1), focused: true, ms: 170 }));

const steps: readonly Step[] = [
  { typed: "", focused: false, ms: 800 },
  { typed: "", focused: true, ms: 500 },
  ...typing,
  { typed: QUERY, focused: true, ms: 250 },
  { typed: QUERY, focused: true, loading: true, ms: 650 },
  // Results land: the bubble swaps its spinner back for the clear glyph as the list pours out.
  { typed: QUERY, focused: true, list: true, ms: 1500 },
  { typed: QUERY, focused: true, list: true, pressed: 0, ms: 240 },
  { typed: QUERY, focused: true, list: true, resolving: 0, ms: 1300 },
  // Resolved: focus leaves, and the bubbles and the list melt home as they last looked while the address settles in.
  { typed: "48 Juniper Lane", focused: false, resolved: true, resolving: 0, ms: 2800 },
  // The demo sets the address back to nil: the field settles on `morph` while the check and locality go.
  { typed: "", focused: false, clearing: true, ms: ms("morph") },
];

function Icon({ d, size, stroke = 2.2, fill }: { d: string; size: number; stroke?: number; fill?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

/** SF Symbols' `mappin.and.ellipse`, `mappin` and `xmark`, drawn as paths. */
const PIN_ELLIPSE = "M12 4.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 0 1 0-5.2M12 9.7V17M8 15.2c-2.4.45-4 1.3-4 2.3c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5c0-1-1.6-1.85-4-2.3";
const PIN = "M12 3.5a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6M12 9.1V20.5";
const XMARK = "M7 7l10 10M17 7L7 17";
const CHECK = "M5.5 12.5l4.2 4.2L18.5 7.5";

/** The system activity indicator: eight spokes fading around, stepping like UIKit's. */
function Spinner({ size }: { size: number }) {
  return (
    <svg data-motion aria-hidden viewBox="0 0 24 24" style={{ width: u(size), height: u(size), flexShrink: 0, animation: "af-spin .8s steps(8) infinite" }}>
      {Array.from({ length: 8 }, (_, k) => (
        <line key={k} x1="12" y1="3" x2="12" y2="7.5" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" opacity={0.25 + (0.75 * k) / 7} transform={`rotate(${k * 45} 12 12)`} />
      ))}
    </svg>
  );
}

/** One weight throughout, so colour carries the match: the matched run in the label colour, the rest quieter. */
function Title({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || at < 0) return <>{text}</>;
  const quiet: CSSProperties = { color: ground.muted };
  return <><span style={quiet}>{text.slice(0, at)}</span>{text.slice(at, at + query.length)}<span style={quiet}>{text.slice(at + query.length)}</span></>;
}

/** Two glyphs in one place: the one leaving blurs out as the other sharpens in (`motion.swap`). */
function Swap({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <span data-motion className="absolute inset-0 flex items-center justify-center" style={{
      opacity: show ? 1 : 0, filter: `blur(${show ? 0 : 4}px)`, transform: `scale(${show ? 1 : 0.8})`,
      transition: t(["opacity", "filter", "transform"], "snap"),
    }}>{children}</span>
  );
}

export function AddressFieldPreview() {
  const s = useSteps(steps);
  const listOut = !!s.list;
  const busy = s.resolving !== undefined;
  const rowOut = busy && !s.resolved;
  const accessoryOut = s.focused && (s.typed.length > 0 || !!s.loading);
  // While either bubble is out the field and the list give it their end, so their edges stay in line.
  const column = accessoryOut || rowOut ? COLUMN : 0;
  const columnMove = (out: boolean) => t("margin-right", out ? liquid.split : liquid.home);
  // The folding list keeps the query it was matched against.
  const query = s.resolved ? QUERY : s.typed;
  // The check and locality line stay mounted while they go.
  const shown = s.resolved || s.clearing;
  const street = useRef<HTMLDivElement>(null);

  // Taking the address adds the locality line, so the street rises 10 to make room, and clearing it brings the
  // street back down: a FLIP of that move on `morph`, the way SwiftUI animates the field's layout. Transform only,
  // so nothing reflows per frame; a layout effect, so the new position never shows for a frame first.
  useLayoutEffect(() => {
    const from = s.resolved ? 10 : s.clearing ? -10 : 0;
    if (!from || !street.current || reduced()) return;
    const { easing } = curve("morph");
    const a = street.current.animate([{ transform: `translateY(${u(from)})` }, { transform: "none" }], { duration: ms("morph"), easing });
    return () => a.cancel();
  }, [s.resolved, s.clearing]);

  const row: CSSProperties = { display: "flex", alignItems: "center", gap: u(12), minHeight: u(ROW), paddingInline: u(10), borderRadius: u(12) };
  const fade = (role: "snap" | "morph") => `af-in ${ms(role)}ms ${curve(role).easing} both`;
  const fadeOut = `af-out ${ms("morph")}ms ${curve("morph").easing} both`;
  // The list's height grows from the sliver on the bud's own spring.
  const pour = t("height", listOut ? liquid.split : liquid.home);
  // Once it has melted all the way in, the list is gone, as Swift removes it, so its sliver never rests against the
  // inside of the field's edge. Opacity, not visibility: a glass shape draws its fill whatever its parent's visibility.
  const placed = budStyle({ out: listOut, home: [0, -LIST_HOME] }, u(1));
  const listBud: CSSProperties = { ...placed, opacity: listOut ? 1 : 0, transition: `${placed.transition}, opacity 0s linear ${listOut ? 0 : ms(liquid.home) + 40}ms` };
  return (
    <div className="absolute inset-0" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text, fontWeight: 600 }}>
      <style>{`@keyframes af-spin{to{transform:rotate(360deg)}}@keyframes af-caret{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes af-pop{from{transform:scale(.6);opacity:0;filter:blur(4px)}to{transform:none;opacity:1;filter:none}}@keyframes af-in{from{opacity:0}to{opacity:1}}@keyframes af-out{from{opacity:1}to{opacity:0}}`}</style>
      <div style={{ position: "absolute", left: "50%", top: u(60), width: u(430), transform: "translateX(-50%)" }}>
        <LiquidGroup unit={u(1)} axis="both">
          {/* The field, above the list so the list at home slips under it, with the accessory bubble beside its end. */}
          <div className="relative" style={{ zIndex: 1 }}>
            <span className="absolute right-0 top-0" style={{ width: u(H), height: u(H) }}>
              <Liquid bud={{ out: accessoryOut, home: [rowOut ? TUCKED : AT_EDGE, 0] }} className="relative flex items-center justify-center" style={{ width: u(H), height: u(H), color: ground.text }}>
                <BudContent out={accessoryOut}>
                  <span className="relative flex" style={{ width: u(20), height: u(20), color: s.loading ? ground.muted : ground.text }}>
                    <Swap show={!!s.loading}><Spinner size={16} /></Swap>
                    <Swap show={!s.loading}><Icon d={XMARK} size={16} stroke={2.6} /></Swap>
                  </span>
                </BudContent>
              </Liquid>
            </span>
            <Liquid radius={18} className="relative flex items-center" style={{
              gap: u(12), minHeight: u(H), paddingLeft: u(16), paddingRight: u(shown ? 12 : 16), paddingBlock: u(8), boxSizing: "border-box",
              marginRight: u(column), transition: columnMove(column > 0),
            }}>
              {/* The ring is drawn inside the glass, a few points in from its edge so the clear bubble's neck never cuts
                  it. Focus lands on `snap`; when an address is taken it leaves with `morph`. */}
              <span data-motion aria-hidden className="pointer-events-none absolute" style={{
                inset: u(3), borderRadius: u(15), boxShadow: `inset 0 0 0 ${u(2)} ${s.focused ? signal.fill : "transparent"}`, transition: t("box-shadow", s.resolved ? "morph" : "snap"),
              }} />
              <span style={{ color: signal.fill, display: "flex", width: u(32), justifyContent: "center" }}><Icon d={PIN_ELLIPSE} size={21} stroke={2.2} /></span>
              <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                <div ref={street} data-motion className="flex items-center" style={{ fontSize: u(17), height: u(24), whiteSpace: "nowrap" }}>
                  {s.typed ? <span>{s.typed}</span> : null}
                  {s.focused ? <span data-motion style={{ width: u(2), height: u(21), marginInline: u(1), background: ground.text, animation: "af-caret 1s steps(1) infinite" }} /> : null}
                  {s.typed ? null : <span style={{ color: ground.muted }}>Delivery address</span>}
                </div>
                {shown ? (
                  // Clearing takes it out of flow so the street moves at once, and it goes where it stood, like a
                  // removed SwiftUI view (top 14: its old place, now that the street is centred in the 60-high field).
                  <div data-motion style={{ fontSize: u(15), lineHeight: u(20), color: ground.muted, ...(s.clearing ? { position: "absolute", insetInline: 0, top: u(14), animation: fadeOut } : { animation: fade("morph") }) }}>Bellmont OR 97321</div>
                ) : null}
              </div>
              {shown ? (
                // The resolved outcome, a status inside the glass: it blurs in on its own `success` spring, with the success haptic.
                <span data-motion style={{ flexShrink: 0, width: u(26), height: u(26), borderRadius: "50%", background: blocks.sage, color: ink, display: "grid", placeItems: "center", animation: s.clearing ? fadeOut : `af-pop ${ms("success")}ms ${curve("success").easing} both` }}>
                  <Icon d={CHECK} size={15} stroke={3} />
                </span>
              ) : null}
            </Liquid>
          </div>

          {/* The list pours down out of the field: born as a sliver tucked inside its bottom edge, it springs down to
              rest apart from the field, growing to full height, and melts back the same way, its rows gone the moment
              it heads home. It keeps the field's edge, so the two stay in line beside the bubbles' column. */}
          <div data-motion className="relative" style={{ marginTop: u(liquid.apart), ...listBud, transformOrigin: "center" }}>
            {/* While the list heads home the bubble rides up with its shrinking edge, so it melts in with the list. */}
            <span data-motion className="absolute right-0" style={{ top: u((listOut ? PAD + ROW / 2 : SLIVER / 2) - H / 2), width: u(H), height: u(H), transition: t("top", listOut ? liquid.split : liquid.home) }}>
              <Liquid bud={{ out: rowOut, home: [accessoryOut ? TUCKED : AT_EDGE, 0] }} className="flex items-center justify-center" style={{ width: u(H), height: u(H), color: ground.text }}>
                <BudContent out={rowOut}><Spinner size={16} /></BudContent>
              </Liquid>
            </span>
            <Liquid radius={18} className="relative overflow-hidden" style={{ height: u(listOut ? LIST_H : SLIVER), marginRight: u(column), transition: `${pour}, ${columnMove(column > 0)}` }}>
              {/* The rows are the list's content, on the bud's own clock: gone the moment it heads home. */}
              <div data-motion style={{
                padding: u(PAD), opacity: listOut ? 1 : 0, filter: `blur(${listOut ? 0 : 6}px)`,
                transition: listOut ? "opacity 300ms ease-out 100ms, filter 300ms ease-out 100ms" : "opacity 140ms ease-out, filter 140ms ease-out",
              }}>
                  {SUGGESTIONS.map((sg, k) => {
                    const pressed = s.pressed === k;
                    const active = pressed || s.resolving === k;
                    // The wash is there on touch-down, lands on `snap` when a row is chosen and fades on `dismiss`.
                    const highlight = pressed ? [] : [t("background-color", active ? "snap" : "dismiss")];
                    return (
                      <div key={sg.title} data-motion style={{
                        ...row, background: active ? `color-mix(in srgb, ${ground.text} 9%, transparent)` : "transparent", opacity: busy && s.resolving !== k ? 0.4 : 1,
                        transform: pressed ? `scale(${ROW_PRESS})` : "none",
                        transition: [...highlight, t("opacity", "snap"), t("transform", pressed ? "press" : "release")].join(", "),
                      }}>
                        <span style={{ flexShrink: 0, width: u(32), display: "flex", justifyContent: "center", color: ground.muted }}><Icon d={PIN} size={18} stroke={2.6} /></span>
                        <div style={{ flex: 1, minWidth: 0, paddingBlock: u(8), textAlign: "left" }}>
                          <div style={{ fontSize: u(17), lineHeight: u(22), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Title text={sg.title} query={query} /></div>
                          <div style={{ fontSize: u(15), lineHeight: u(20), color: ground.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sg.subtitle}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Liquid>
          </div>
        </LiquidGroup>
      </div>
    </div>
  );
}
