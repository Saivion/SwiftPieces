"use client";
// Layer Fill in the preview: the same silhouette paths and wave bands the Swift draws. A shelf tap
// drops a band in (0.45 s soft spring; bands ease up in 0.3 s on appear) and a rising haptic; the goal lands with a success
// haptic and a small bounce; tapping the figure takes the last band back.
import { useId, useRef, useState, type CSSProperties } from "react";
import { SILHOUETTES, layerBands, layerItems, type LayerBand } from "../../../definitions/app-pieces/layer-fill.js";
import { Glyph } from "../../icons.js";
import { fillStyle, n, s, useAxis, type Renderer, cr, fw, ts, accentize } from "../env.js";
import { reducedMotion } from "../primitives.js";
import { SPRING, useRuntime } from "../runtime.js";
import { useFirstAppearance } from "./first-appearance.js";

/** `.spring(duration: 0.45, bounce: 0.2)`: a small overshoot for a band dropping in. */
const BOUNCE_SOFT = "cubic-bezier(.34, 1.2, .64, 1)";

/** A band's top edge as a wave, filled down past the bottom of the box (the clip trims it). */
function wavePath(phase: number): string {
  let d = "M 0 200 L 0 0";
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    d += ` L ${(t * 100).toFixed(2)} ${(Math.sin(t * Math.PI * 3 + phase) * 1.4).toFixed(2)}`;
  }
  return `${d} L 100 200 Z`;
}

type Band = LayerBand & { key: number; fresh?: boolean };

export const LayerFill: Renderer = (r) => {
  const { p } = r;
  const axis = useAxis();
  const rt = useRuntime();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shape = SILHOUETTES[s(p, "shape")] ?? SILHOUETTES.orb;
  const shelf = s(p, "items").trim() ? layerItems(p.items) : [];
  const seed = accentize(layerBands(p.layers, shelf.length ? shelf : layerItems("Water")));
  const items = seed.items;
  const seedKey = `${s(p, "items")}|${s(p, "layers")}`;
  const [bands, setBands] = useState<{ key: string; list: Band[] }>(() => ({ key: seedKey, list: seed.bands.map((b, i) => ({ ...b, key: i })) }));
  const list: Band[] = bands.key === seedKey ? bands.list : seed.bands.map((b, i) => ({ ...b, key: i }));
  const next = useRef(1000);
  const [pop, setPop] = useState(0);
  // The bands ease up from empty on first appearance, like the Swift fill from level 0.
  const filled = useFirstAppearance(r.node.id);
  const still = reducedMotion();
  const goal = Math.max(1, n(p, "goal"));
  const serving = Math.max(1, n(p, "serving"));
  const unit = s(p, "unit");
  const height = n(p, "height");
  const readout = s(p, "readout");
  const total = list.reduce((a, b) => a + b.amount, 0);
  const percent = Math.round((total / goal) * 100);
  const scale = Math.max(goal, total);

  const add = (item: number, el: Element) => {
    const nextTotal = total + serving;
    rt.haptic(total < goal && nextTotal >= goal ? "success" : "increase", el);
    if (total < goal && nextTotal >= goal && !still) setPop((x) => x + 1);
    setBands({ key: seedKey, list: [...list.map((b) => ({ ...b, fresh: false })), { item, amount: serving, key: next.current++, fresh: true }] });
  };
  const undo = (el: Element) => {
    if (!list.length) return;
    rt.haptic("decrease", el);
    setBands({ key: seedKey, list: list.slice(0, -1) });
  };

  let upTo = 0;
  const tops = list.map((b) => {
    upTo += b.amount;
    return 100 - (upTo / scale) * 100;
  });

  const readoutView =
    readout === "large" ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <div key={total} style={{ fontSize: ts(46), lineHeight: "52px", fontWeight: fw(700), color: "var(--ios-label)", fontVariantNumeric: "tabular-nums", animation: filled ? `spb-lf-num .3s ease-out` : undefined }}>
          {Math.round(total)}
          {unit}
        </div>
        <div style={{ fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600), color: "var(--ios-label)" }}>{percent}% of your goal</div>
      </div>
    ) : readout === "small" ? (
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: ts(20), lineHeight: "25px", fontWeight: fw(700), color: "var(--ios-label)", fontVariantNumeric: "tabular-nums" }}>
          {Math.round(total)}
          {unit}
        </div>
        <div style={{ fontSize: ts(12), lineHeight: "16px", fontWeight: fw(700), color: "var(--ios-label2)" }}>{percent}%</div>
      </div>
    ) : null;

  return (
    <div {...r.box} style={{ ...r.box.style, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, ...fillStyle(true, axis) }}>
      <style>{KEYFRAMES}</style>
      {readoutView}
      <svg
        key={pop}
        viewBox="0 0 100 100"
        width={height}
        height={height}
        role="img"
        aria-label={`${Math.round(total)} ${unit} of ${goal}`}
        onClick={(e) => undo(e.currentTarget)}
        style={{ display: "block", cursor: "pointer", overflow: "visible", animation: pop ? `spb-lf-pop .6s ${SPRING}` : undefined, flex: "none" }}
      >
        <defs>
          <clipPath id={`lf${uid}`}>
            <path d={shape.d} />
          </clipPath>
        </defs>
        <g clipPath={`url(#lf${uid})`}>
          <rect x="0" y="0" width="100" height="100" fill="rgba(142,142,147,.16)" />
          {list
            .map((b, i) => ({ b, i }))
            .reverse()
            .map(({ b, i }) => (
              <path
                key={b.key}
                d={wavePath(i * 1.7)}
                fill={items[b.item]?.color ?? "#4D8DFF"}
                style={{ transform: `translateY(${filled || still ? tops[i] : 104}px)`, opacity: filled ? 1 : 0, transition: still ? "opacity .2s ease-out" : `transform ${b.fresh ? ".45s" : ".3s"} ${b.fresh ? BOUNCE_SOFT : "ease-out"}, opacity .3s ease-out`, animation: b.fresh && !still ? `spb-lf-rise .45s ${BOUNCE_SOFT}` : undefined } as CSSProperties}
              />
            ))}
        </g>
      </svg>
      {shelf.length ? (
        <div style={{ display: "flex", alignSelf: "stretch", justifyContent: "space-between", gap: 6 }}>
          {shelf.map((it, i) => (
            <ShelfButton key={it.name} name={it.name} color={it.color} onTap={(el) => add(i, el)} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

function ShelfButton({ name, color, onTap }: { name: string; color: string; onTap: (el: Element) => void }) {
  const [down, setDown] = useState(false);
  return (
    <button
      type="button"
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onClick={(e) => onTap(e.currentTarget)}
      style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: 0, padding: 0, cursor: "pointer", transform: down ? "scale(.97)" : undefined, opacity: down ? 0.85 : 1, transition: "transform .12s ease-out, opacity .12s ease-out" }}
    >
      <span style={{ position: "relative", width: 34, height: 42, borderRadius: cr("4px 4px 9px 9px"), background: color, display: "block" }}>
        <span style={{ position: "absolute", left: "50%", bottom: -8, transform: "translateX(-50%)", width: 18, height: 18, borderRadius: cr(9), background: "rgba(255,255,255,.9)", color, display: "grid", placeItems: "center" }}>
          <Glyph name="plus" size={12} strokeWidth={3} />
        </span>
      </span>
      <span style={{ marginTop: 4, fontSize: ts(11), lineHeight: "13px", fontWeight: fw(700), letterSpacing: 0.3, color: "var(--ios-label2)", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{name}</span>
    </button>
  );
}

const KEYFRAMES =
  "@keyframes spb-lf-rise{from{transform:translateY(100px)}}@keyframes spb-lf-num{from{transform:translateY(30%);opacity:.3}}@keyframes spb-lf-pop{0%{transform:scale(1)}40%{transform:scale(1.06)}100%{transform:scale(1)}}";
