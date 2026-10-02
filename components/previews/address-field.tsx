"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { blocks, font, ground, ink, signal } from "./palette";

/*
 * Address Field: a query is typed, suggestions load under the field with the match in bold, one is picked,
 * its row spins while the address resolves, then the list folds away and the field settles into the street,
 * the locality line and a sage check.
 * Sizes are authored in px against the 560 px docs stage and converted to `cqw`.
 */

const u = (px: number) => `${(px / 5.6).toFixed(3)}cqw`;
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const spring = "cubic-bezier(0.34, 1.4, 0.64, 1)";

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

const SUGGESTIONS = [
  { title: "48 Juniper Lane", subtitle: "Bellmont, OR, United States" },
  { title: "48 Juniper Court", subtitle: "Ashford, WA, United States" },
  { title: "48 Junipero Street", subtitle: "Alder Bay, CA, United States" },
  { title: "48 Juniper Row", subtitle: "Harlow, ON, Canada" },
];
const QUERY = "48 Juni";

type Step = {
  typed: string;
  focused: boolean;
  /** Suggestions are on screen. */
  list?: boolean;
  loading?: boolean;
  pressed?: number;
  resolving?: number;
  resolved?: boolean;
  ms: number;
};

const typing: Step[] = Array.from({ length: QUERY.length }, (_, i) => ({
  typed: QUERY.slice(0, i + 1),
  focused: true,
  loading: i >= 2,
  list: i >= 5,
  ms: 170,
}));

const steps: readonly Step[] = [
  { typed: "", focused: false, ms: 1300 },
  { typed: "", focused: true, ms: 500 },
  ...typing,
  { typed: QUERY, focused: true, loading: true, list: true, ms: 380 },
  { typed: QUERY, focused: true, list: true, ms: 1100 },
  { typed: QUERY, focused: true, list: true, pressed: 0, ms: 220 },
  { typed: QUERY, focused: true, list: true, resolving: 0, ms: 1000 },
  { typed: "48 Juniper Lane", focused: false, resolved: true, ms: 2800 },
];

function Icon({ d, size, stroke = 2.2, fill }: { d: string; size: number; stroke?: number; fill?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ width: u(size), height: u(size), flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

/** SF Symbols' `mappin.and.ellipse` and `mappin`, drawn as paths. */
const PIN_ELLIPSE = "M12 4.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 0 1 0-5.2M12 9.7V17M8 15.2c-2.4.45-4 1.3-4 2.3c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5c0-1-1.6-1.85-4-2.3";
const PIN = "M12 3.5a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6M12 9.1V20.5";
/** Suggestion tiles: small solid blocks with the pin in ink, as `Style.tiles` in Swift. */
const TILES = [blocks.sky, blocks.butter, blocks.sage, blocks.lilac];
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

function Title({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<b style={{ fontWeight: 700 }}>{text.slice(at, at + query.length)}</b>{text.slice(at + query.length)}</>;
}

export function AddressFieldPreview() {
  const s = useSteps(steps);
  const open = !!s.list && !s.resolved;
  const busy = s.resolving !== undefined;
  const row: CSSProperties = { display: "flex", alignItems: "center", gap: u(12), minHeight: u(56), paddingInline: u(10), borderRadius: u(12) };
  return (
    <div className="absolute inset-0" style={{ background: ground.bg, fontFamily: font.stack, color: ground.text }}>
      <style>{`@keyframes af-spin{to{transform:rotate(360deg)}}@keyframes af-caret{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes af-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}@keyframes af-in{from{opacity:0}to{opacity:1}}`}</style>
      <div style={{ position: "absolute", left: "50%", top: u(76), width: u(430), transform: "translateX(-50%)" }}>
        {/* Field */}
        <div
          data-motion
          style={{
            display: "flex", alignItems: "center", gap: u(12), minHeight: u(56), paddingLeft: u(16), paddingRight: u(8), paddingBlock: u(8),
            borderRadius: u(18), background: ground.field, boxSizing: "border-box",
            boxShadow: s.focused ? `inset 0 0 0 ${u(2)} ${signal.fill}` : "none", transition: "box-shadow .2s",
          }}
        >
          <span style={{ color: signal.fill, display: "flex", width: u(32), justifyContent: "center" }}><Icon d={PIN_ELLIPSE} size={21} stroke={2.2} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center" style={{ fontSize: u(17), height: u(24), whiteSpace: "nowrap" }}>
              {s.typed ? <span>{s.typed}</span> : null}
              {s.focused ? <span data-motion style={{ width: u(2), height: u(21), marginInline: u(1), background: ground.text, animation: "af-caret 1s steps(1) infinite" }} /> : null}
              {s.typed ? null : <span style={{ color: ground.muted }}>Delivery address</span>}
            </div>
            {s.resolved ? (
              <div data-motion style={{ fontSize: u(15), lineHeight: u(20), color: ground.muted, animation: "af-in .35s ease both" }}>Bellmont OR 97321</div>
            ) : null}
          </div>
          <span style={{ width: u(44), height: u(44), display: "grid", placeItems: "center", flexShrink: 0, color: ground.muted }}>
            {s.resolved ? (
              <span data-motion style={{ width: u(26), height: u(26), borderRadius: "50%", background: blocks.sage, color: ink, display: "grid", placeItems: "center", animation: `af-pop .45s ${spring} both` }}>
                <Icon d={CHECK} size={15} stroke={3.4} />
              </span>
            ) : s.loading ? <Spinner size={16} /> : null}
          </span>
        </div>

        {/* Suggestions */}
        <div data-motion className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transform: open ? "none" : `translateY(${u(-8)})`, transition: `grid-template-rows .42s ${ease}, opacity .25s, transform .35s ${ease}` }}>
          <div className="min-h-0 overflow-hidden">
            <div style={{ marginTop: u(8), padding: u(6), borderRadius: u(18), background: ground.field }}>
              {SUGGESTIONS.map((sg, k) => {
                const active = s.pressed === k || s.resolving === k;
                return (
                  <div
                    key={sg.title}
                    data-motion
                    style={{
                      ...row, background: active ? ground.control : "transparent", opacity: busy && s.resolving !== k ? 0.4 : 1,
                      transform: s.pressed === k ? "scale(0.985)" : "none", transition: `background-color .15s, opacity .2s, transform .25s ${spring}`,
                    }}
                  >
                    <span style={{ flexShrink: 0, width: u(32), height: u(32), borderRadius: u(10), background: TILES[k % TILES.length], color: ink, display: "grid", placeItems: "center" }}><Icon d={PIN} size={17} stroke={2.6} /></span>
                    <div style={{ flex: 1, minWidth: 0, paddingBlock: u(8) }}>
                      <div style={{ fontSize: u(17), lineHeight: u(22), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Title text={sg.title} query={s.typed} /></div>
                      <div style={{ fontSize: u(15), lineHeight: u(20), color: ground.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sg.subtitle}</div>
                    </div>
                    {s.resolving === k ? <span style={{ color: ground.text, display: "flex" }}><Spinner size={16} /></span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
