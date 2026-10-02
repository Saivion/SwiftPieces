"use client";
// Index Scrubber in the Playground: a grouped list with the A to Z rail on its trailing edge. Press or drag
// the rail to jump; the accent block follows the finger and rolls its letter the way you move, a selection
// haptic plays per new section, dimmed letters land on the next section, and a short frame collapses the
// rail with dots. Focus the rail and type a letter or use the arrow keys, as with a hardware keyboard.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { house } from "../../../core/palette.js";
import { list } from "../../../core/swift.js";
import { MAX_ITEMS, groupItems } from "../../../definitions/utility/index-scrubber.js";
import { ACCENT, ACCENT_INK, fillStyle, houseVar, n, s, ts, cr, useAxis, type Renderer } from "../env.js";
import { useRuntime } from "../runtime.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const ROW = 16;
const COLUMN = 20;
const TRACK = COLUMN + 8;
const HIT = 44;
const BUBBLE = 68;
const INSET = 8;
/** The block and the current dot: the app's accent (house red unless Style changes it). */
const BUTTER = ACCENT;
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
const spring = "cubic-bezier(0.34, 1.35, 0.64, 1)";

type Entry = { title: string; target: number | null };
type Row = { kind: "entry"; i: number } | { kind: "dot" };

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** The entries the rail lists, matched to sections the way `IndexModel` does in Swift. */
function buildEntries(titles: string[], index: string, missing: string): Entry[] {
  if (index === "sections") return titles.map((title, i) => ({ title, target: i }));
  const all = ALPHABET.map((title) => ({ title, target: titles.indexOf(title) >= 0 ? titles.indexOf(title) : null }));
  if (!all.some((e) => e.target !== null)) return [];
  return missing === "hidden" ? all.filter((e) => e.target !== null) : all;
}

/** Every entry, or evenly spaced entries with a dot between each when the rail is too short (odd slots, A • … • #). */
function buildRows(count: number, capacity: number): Row[] {
  if (count <= 0 || capacity <= 0) return [];
  if (count <= capacity) return Array.from({ length: count }, (_, i) => ({ kind: "entry", i }));
  const slots = capacity % 2 === 0 ? capacity - 1 : capacity;
  if (slots < 3) return [{ kind: "entry", i: 0 }];
  const shown = (slots + 1) / 2;
  const rows: Row[] = [];
  for (let k = 0; k < shown; k++) {
    if (k > 0) rows.push({ kind: "dot" });
    rows.push({ kind: "entry", i: Math.round((k * (count - 1)) / (shown - 1)) });
  }
  return rows;
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const reduced = useReducedMotion();
  const height = Math.max(120, n(p, "height") || 540);
  const groups = useMemo(() => groupItems(list(p.items, MAX_ITEMS)), [p.items]);
  const titles = useMemo(() => groups.map((g) => g.title), [groups]);
  const entries = useMemo(() => buildEntries(titles, s(p, "index"), s(p, "missing")), [titles, p.index, p.missing]);
  const rows = useMemo(() => buildRows(entries.length, Math.floor((height - INSET * 2 - 12) / ROW)), [entries.length, height]);
  const colHeight = rows.length * ROW;
  const top = (height - colHeight) / 2;

  const listRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [active, setActive] = useState<number | null>(null);
  const [down, setDown] = useState(true);
  const [focused, setFocused] = useState(false);
  const dragging = useRef(false);
  const flash = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (flash.current) clearTimeout(flash.current); }, []);
  // Titles changed under an active scrub: drop it rather than point at a missing entry.
  useEffect(() => { setActive((a) => (a !== null && a < entries.length ? a : null)); }, [entries.length]);

  const resolve = (i: number): number | null => {
    if (i < 0 || i >= entries.length) return null;
    if (entries[i].target !== null) return i;
    for (let k = i + 1; k < entries.length; k++) if (entries[k].target !== null) return k;
    for (let k = i - 1; k >= 0; k--) if (entries[k].target !== null) return k;
    return null;
  };

  const jump = (section: number) => {
    const el = sectionRefs.current[titles[section]];
    if (el && listRef.current) listRef.current.scrollTop = el.offsetTop;
  };

  /** Scrolls and ticks only when the landing section changes, except on touch down, which always scrolls. */
  const land = (entry: number, force: boolean) => {
    const target = entries[entry]?.target;
    if (target === null || target === undefined) return;
    const prevTarget = active !== null ? entries[active]?.target : null;
    if (active !== null && active !== entry) setDown(entry > active);
    setActive(entry);
    if (prevTarget !== target || force) {
      jump(target);
      if (prevTarget !== target) rt.haptic("selection", railRef.current);
    }
  };

  const entryAt = (clientY: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || !entries.length || !colHeight) return 0;
    const y = (clientY - rect.top) / (rt.scale() || 1);
    const f = Math.min(Math.max((y - top) / colHeight, 0), 0.9999);
    return Math.min(Math.floor(f * entries.length), entries.length - 1);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    dragging.current = true;
    if (flash.current) clearTimeout(flash.current);
    const hit = resolve(entryAt(e.clientY));
    if (hit !== null) land(hit, true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const hit = resolve(entryAt(e.clientY));
    if (hit !== null && hit !== active) land(hit, false);
  };
  const release = () => {
    if (!dragging.current) return;
    dragging.current = false;
    setActive(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? null;
    let next: number | null = null;
    if (e.key === "ArrowDown") {
      for (let k = (current ?? -1) + 1; k < entries.length; k++) if (entries[k].target !== null) { next = k; break; }
    } else if (e.key === "ArrowUp") {
      for (let k = (current ?? entries.length) - 1; k >= 0; k--) if (entries[k].target !== null) { next = k; break; }
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const hit = entries.findIndex((x) => x.title.localeCompare(e.key, undefined, { sensitivity: "base" }) === 0);
      if (hit < 0) return;
      next = resolve(hit);
    } else return;
    e.preventDefault();
    if (next === null) return;
    land(next, true);
    if (flash.current) clearTimeout(flash.current);
    flash.current = setTimeout(() => { if (!dragging.current) setActive(null); }, 700);
  };

  const activeRow = active !== null && rows.length ? Math.min(Math.floor(((active + 0.5) / entries.length) * rows.length), rows.length - 1) : -1;
  const target = active !== null ? entries[active]?.target ?? null : null;
  const bubbleTop = active !== null ? Math.min(Math.max(top + ((active + 0.5) / entries.length) * colHeight - BUBBLE / 2, 0), Math.max(height - BUBBLE, 0)) : 0;
  const showTrack = active !== null || focused;
  // The block keeps its last letter while it fades out.
  const shown = useRef("");
  if (target !== null) shown.current = titles[target] ?? shown.current;

  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height, color: houseVar("text") }}>
      <style>{"@keyframes spis-down{from{transform:translateY(70%);opacity:0}to{transform:none;opacity:1}}@keyframes spis-up{from{transform:translateY(-70%);opacity:0}to{transform:none;opacity:1}}"}</style>
      {/* The list, inset by the rail's width like the modifier's safe-area inset. */}
      <div ref={listRef} style={{ position: "absolute", inset: 0, right: entries.length ? HIT : 0, zIndex: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
        {groups.map((g) => (
          <div key={g.title} ref={(el) => { sectionRefs.current[g.title] = el; }}>
            <div style={{ position: "sticky", top: 0, zIndex: 1, padding: "6px 20px", background: houseVar("ground"), color: houseVar("muted"), fontSize: ts(15), fontWeight: 700 }}>{g.title}</div>
            {g.names.map((name) => (
              <div key={name} style={{ display: "flex", alignItems: "center", minHeight: 48, paddingLeft: 20, fontSize: ts(17) }}>{name}</div>
            ))}
          </div>
        ))}
      </div>

      {entries.length ? (
        <div
          ref={railRef}
          role="slider"
          aria-label="Section index"
          aria-valuetext={target !== null ? titles[target] : titles[0]}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, zIndex: 1, width: HIT, touchAction: "none", cursor: "pointer", outline: "none" }}
        >
          <div style={{ position: "absolute", right: 4, top: top - 6, width: TRACK, height: colHeight + 12, borderRadius: cr(TRACK / 2), background: houseVar("field"), opacity: showTrack ? 1 : 0, transition: `opacity .2s ${ease}` }} />
          {rows.map((row, k) => {
            const on = k === activeRow;
            const y = top + k * ROW;
            if (row.kind === "dot") {
              const d = on ? 8 : 4;
              return <span key={k} style={{ position: "absolute", right: 4 + TRACK / 2 - d / 2, top: y + ROW / 2 - d / 2, width: d, height: d, borderRadius: 99, background: on ? BUTTER : houseVar("muted"), opacity: on ? 1 : 0.55, transition: reduced ? undefined : `all .22s ${spring}` }} />;
            }
            const entry = entries[row.i];
            return (
              <div key={k} style={{ position: "absolute", right: 4, top: y, width: TRACK, height: ROW, display: "grid", placeItems: "center", fontSize: ts(11), fontWeight: 700, lineHeight: 1, color: on ? ACCENT_INK : houseVar("muted") }}>
                <span style={{ position: "absolute", width: 19, height: 19, borderRadius: 99, background: BUTTER, transform: `scale(${on ? 1 : 0.3})`, opacity: on ? 1 : 0, transition: reduced ? "opacity .15s" : `transform .22s ${spring}, opacity .15s` }} />
                <span style={{ position: "relative", color: on ? ACCENT_INK : entry.target === null ? undefined : houseVar("text"), opacity: !on && entry.target === null ? 0.45 : 1 }}>{entry.title}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* The letter block beside the finger. */}
      {entries.length ? (
        <div
          aria-hidden
          style={{
            position: "absolute", zIndex: 2, right: TRACK + 4 + 26, top: bubbleTop, minWidth: BUBBLE, height: BUBBLE, padding: "0 12px", boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: cr(18),
            background: BUTTER, color: ACCENT_INK, fontSize: ts(34), fontWeight: 700, letterSpacing: "-0.01em", pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,.18)", opacity: target !== null ? 1 : 0,
            transform: `scale(${target !== null || reduced ? 1 : 0.4})`, transformOrigin: "right center",
            transition: reduced ? "opacity .15s" : `top .24s ${spring}, opacity .2s ${ease}, transform .28s ${target !== null ? spring : ease}`,
          }}
        >
          {target !== null ? (
            <span key={titles[target]} style={{ display: "block", whiteSpace: "nowrap", animation: reduced ? undefined : `${down ? "spis-down" : "spis-up"} .2s ${ease} both` }}>{titles[target]}</span>
          ) : (
            <span style={{ display: "block", whiteSpace: "nowrap" }}>{shown.current}</span>
          )}
        </div>
      ) : null}
    </div>
  );
};
