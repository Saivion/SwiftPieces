"use client";
// Color Block List: flat colour rows you tap to open and swipe left to reveal edit and delete (a
// delete folds the row away), or tiles side by side. Mirrors ColorBlockList in the export.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { blockColor, parseBlocks, type Block } from "../../../definitions/app-pieces/color-block-list.js";
import { Glyph } from "../../icons.js";
import { b, n, s, useAxis, type Renderer, cr, fw, ts } from "../env.js";
import { injectStyle, reducedMotion } from "../primitives.js";
import { SPRING, useDrag, useLive, useRuntime, useTap } from "../runtime.js";
import { useFirstAppearance } from "./first-appearance.js";

const INK = "rgba(0,0,0,.82)";
injectStyle("spcbl-css", "@keyframes spcbl-in{from{opacity:0;transform:scale(.8)}}");
const REVEAL = 132;

function Row({ block, height, swipe, onOpen, onDelete }: { block: Block; height: number; swipe: boolean; onOpen: (el: Element) => void; onDelete: (el: Element) => void }) {
  const rt = useRuntime();
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [down, setDown] = useState(false);
  const open = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const settle = (next: boolean) => {
    if (next !== open.current) rt.haptic("selection", ref.current);
    open.current = next;
    setOffset(next ? -REVEAL : 0);
  };
  const drag = useDrag({
    axis: "x",
    onStart: () => setDragging(true),
    onMove: ({ dx }) => {
      const raw = (open.current ? -REVEAL : 0) + dx;
      setOffset(raw > 0 ? raw * 0.15 : raw < -REVEAL ? -REVEAL + (raw + REVEAL) * 0.3 : raw);
    },
    onEnd: ({ dx, vx }) => {
      setDragging(false);
      settle((open.current ? -REVEAL : 0) + dx + vx * 0.15 < -REVEAL / 2);
    },
  });
  return (
    <div ref={ref} style={{ position: "relative", height, overflow: "hidden", background: "var(--ios-bg, #fff)" }}>
      {swipe && (
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: REVEAL, display: "flex", color: "var(--ios-label)" }}>
          <button type="button" onClick={() => settle(false)} style={action} aria-label="Edit"><Glyph name="pencil" size={20} /></button>
          <button type="button" onClick={(e) => onDelete(e.currentTarget)} style={action} aria-label="Delete"><Glyph name="trash" size={20} /></button>
        </div>
      )}
      <div
        onPointerDown={(e) => {
          setDown(true);
          if (swipe) drag(e);
        }}
        onPointerUp={() => setDown(false)}
        onPointerLeave={() => setDown(false)}
        onPointerCancel={() => setDown(false)}
        onClick={(e) => (open.current ? settle(false) : onOpen(e.currentTarget))}
        style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", background: blockColor(block.color), color: INK,
          transform: `translateX(${offset}px)`, transition: dragging ? "none" : `transform .42s ${SPRING}`, cursor: "pointer", touchAction: "pan-y",
          boxShadow: down && !dragging ? "inset 0 0 0 999px rgba(0,0,0,.08)" : "inset 0 0 0 999px rgba(0,0,0,0)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          {block.eyebrow && <span style={{ fontSize: ts(11), opacity: 0.7 }}>{block.eyebrow}</span>}
          <span style={{ fontSize: ts(15), fontWeight: fw(600), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{block.title}</span>
        </div>
        <span style={{ fontSize: ts(20), fontVariantNumeric: "tabular-nums" }}>{block.value}</span>
      </div>
    </div>
  );
}

const action: CSSProperties = { flex: 1, border: 0, background: "transparent", color: "inherit", display: "grid", placeItems: "center", cursor: "pointer" };

export const ColorBlockList: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const tap = useTap(p.link);
  const seed = parseBlocks(p);
  const key = JSON.stringify(seed);
  const [blocks, setBlocks] = useLive(key);
  const [gone, setGone] = useState<string[]>([]);
  const live = (JSON.parse(blocks) as Block[]).map((bl, i) => ({ ...bl, key: `${i}` }));
  const height = n(p, "height");
  const bleed = n(p, "bleed");
  const header = s(p, "header").trim();
  const tiles = s(p, "layout") === "tiles";
  const gap = n(p, "gap");
  const radius = n(p, "radius");
  const selectable = tiles && b(p, "selectable");
  const [picked, setPicked] = useState<string[]>([]);
  const [pressed, setPressed] = useState<string | null>(null);
  // Blocks ease in from 0.95 with a fade, 40 ms apart, like the Swift BlockEntrance modifier.
  const shown = useFirstAppearance(r.node.id);
  const [appearedBefore] = useState(shown);
  const [settled, setSettled] = useState(appearedBefore);
  const still = reducedMotion();
  useEffect(() => {
    const id2 = window.setTimeout(() => setSettled(true), 700);
    return () => {
      window.clearTimeout(id2);
    };
  }, []);
  const enter = (i: number): CSSProperties => {
    const d = still ? 0 : Math.min(i, 7) * 0.04;
    return { opacity: shown ? 1 : 0, scale: shown || still ? "1" : "0.95", transition: settled ? "scale .12s ease-out" : `scale .3s ease-out ${d}s, opacity ${still ? 0.2 : 0.3}s ease-out ${d}s` };
  };
  const del = (k: string, el: Element) => {
    rt.haptic("warning", el);
    setGone((g) => [...g, k]);
    setTimeout(() => {
      setBlocks((cur) => JSON.stringify((JSON.parse(cur) as Block[]).filter((_, i) => `${i}` !== k)));
      setGone([]);
    }, 320);
  };
  return (
    <div {...r.box} style={{ ...r.box.style, ...(axis === "v" ? { alignSelf: "stretch" } : { flex: "1 1 0", minWidth: 0 }), margin: bleed ? `0 -${bleed}px` : undefined, display: "flex", flexDirection: "column" }}>
      {header && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 16px", fontSize: ts(12), color: "var(--ios-label2)", background: "var(--ios-fill4, rgba(120,120,128,.08))" }}>
          <span>{header}</span>
          <span>{s(p, "headerValue")}</span>
        </div>
      )}
      {tiles ? (
        <div style={{ display: "flex", height, gap }}>
          {live.map((bl) => (
            <button
              key={bl.key}
              type="button"
              onPointerDown={() => setPressed(bl.key)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              onClick={(e) => {
                if (!selectable) return tap(e);
                rt.haptic("selection", e.currentTarget);
                setPicked((cur) => (cur.includes(bl.key) ? cur.filter((k) => k !== bl.key) : [...cur, bl.key]));
              }}
              aria-pressed={selectable ? picked.includes(bl.key) : undefined}
              style={{ ...enter(Number(bl.key)), ...(settled && pressed === bl.key ? { scale: "0.97" } : {}), flex: 1, minWidth: 0, border: 0, borderRadius: cr(radius), background: `linear-gradient(color-mix(in srgb, ${blockColor(bl.color)} 86%, #fff) 50%, ${blockColor(bl.color)} 50%)`, color: INK, padding: 20, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, textAlign: "left", cursor: "pointer", font: "inherit" }}
            >
              <span style={{ display: "flex", alignSelf: "stretch", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: ts(12), opacity: 0.7 }}>{bl.eyebrow}</span>
                {selectable ? <Glyph key={picked.includes(bl.key) ? "on" : "off"} name={picked.includes(bl.key) ? "checkmark.circle.fill" : "plus.circle.fill"} size={20} style={{ animation: "spcbl-in .15s ease-out" }} /> : null}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: ts(22), fontWeight: fw(500), fontVariantNumeric: "tabular-nums" }}>{bl.value}</span>
              <span style={{ fontSize: ts(11), opacity: 0.7 }}>{bl.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap }}>
        {live.map((bl) => (
          <div key={`${key}-${bl.key}`} style={{ height: gone.includes(bl.key) ? 0 : height, opacity: gone.includes(bl.key) ? 0 : 1, transform: gone.includes(bl.key) ? "translateX(-30%)" : undefined, transition: `height .32s ${SPRING}, opacity .25s, transform .32s ${SPRING}`, overflow: "hidden", borderRadius: cr(radius) }}>
            <div style={enter(Number(bl.key))}>
            <Row block={bl} height={height} swipe={b(p, "swipeActions") || p.swipeActions === undefined} onOpen={(el) => tap({ currentTarget: el })} onDelete={(el) => del(bl.key, el)} />
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};
