"use client";
// Bubble Field: drag to pan the honeycomb; bubbles swell near the middle. Tap one and the field
// glides it to the centre, it grows, and a confirm button rises from the bottom.
import { useLayoutEffect, useRef, useState } from "react";
import { hsb } from "../../../definitions/app-pieces/wellbeing-shared.js";
import { bubbleTones, layoutBubbles, lensScale, quadrantsOf } from "../../../definitions/app-pieces/bubble-field.js";
import { b, n, s, type Renderer, cr, fw, ts, ACCENT } from "../env.js";
import { Glyph } from "../../icons.js";
import { SPRING, useDrag, useLive, useRuntime } from "../runtime.js";
import { EASE_OUT, PRESS_TRANSITION, Root, enter, press, stagger, useHaptic } from "./wellbeing-shared.js";

/** Past an edge the field follows the finger at a third of the distance, then springs home on release. */
const rubber = (v: number, lo: number, hi: number) => (v > hi ? hi + (v - hi) * 0.35 : v < lo ? lo + (v - lo) * 0.35 : v);

/** The field fades out at its edges, so a row is never cut off mid-bubble. */
const EDGE_FADE = "linear-gradient(to bottom, transparent 0, #000 14%, #000 86%, transparent 100%), linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)";

export const BubbleField: Renderer = (r) => {
  const diameter = n(r.p, "diameter") || 108;
  const height = n(r.p, "height") || 700;
  const { bubbles, width: fieldW, height: fieldH } = layoutBubbles(quadrantsOf(r.p), n(r.p, "columns") || 6, diameter, 3, bubbleTones(r.p.palette));
  const box = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(393);
  useLayoutEffect(() => {
    const el = box.current;
    if (el) setViewW(el.offsetWidth || 393);
  }, []);
  const [selected, setSelected] = useLive(s(r.p, "selected").trim());
  // Pan offset: where the field's top-left sits in the view. Starts centred on the field.
  const centred = (x: number, y: number) => ({ x: viewW / 2 - x, y: height / 2 - y });
  const start = () => {
    const pick = bubbles.find((bb) => bb.word === selected);
    return pick ? centred(pick.x, pick.y) : centred(fieldW / 2, fieldH / 2);
  };
  const [pan, setPan] = useState(start);
  const [dragging, setDragging] = useState(false);
  const origin = useRef(pan);
  const seeded = useRef(false);
  useLayoutEffect(() => {
    if (!seeded.current && viewW !== 393) {
      seeded.current = true;
      setPan(start());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewW]);
  const clamp = (v: { x: number; y: number }) => ({
    x: Math.min(diameter * 0.2, Math.max(viewW - fieldW - diameter * 0.2, v.x)),
    y: Math.min(diameter * 0.2, Math.max(height - fieldH - diameter * 0.2, v.y)),
  });
  const haptic = useHaptic();
  const rt = useRuntime();
  const drag = useDrag({
    onStart: () => {
      origin.current = pan;
      setDragging(true);
    },
    onMove: ({ dx, dy }) => {
      const lo = clamp({ x: -1e6, y: -1e6 });
      const hi = clamp({ x: 1e6, y: 1e6 });
      setPan({ x: rubber(origin.current.x + dx, lo.x, hi.x), y: rubber(origin.current.y + dy, lo.y, hi.y) });
    },
    onEnd: ({ dx, dy, vx, vy }) => {
      setDragging(false);
      setPan(clamp({ x: origin.current.x + dx + vx * 0.18, y: origin.current.y + dy + vy * 0.18 }));
    },
  });
  const pick = (word: string, x: number, y: number, el: Element) => {
    setSelected(word);
    haptic("selection", el);
    setPan(clamp(centred(x, y)));
  };
  const prefix = s(r.p, "confirmPrefix").trim();
  const link = s(r.p, "link");
  // With nowhere to go, the confirm logs in place: it turns into "Logged" with a success tap.
  const [logged, setLogged] = useState("");
  const isLogged = !link && !!selected && logged === selected;
  const tinted = s(r.p, "style") !== "solid";
  const glass = { width: 44, height: 44, borderRadius: cr(22), display: "grid", placeItems: "center", background: "var(--ios-fill)", backdropFilter: "blur(12px)", color: "var(--ios-label)", pointerEvents: "auto" as const };

  return (
    <Root r={r} style={{ position: "relative", alignSelf: "stretch", height, overflow: "hidden", borderRadius: cr(n(r.p, "radius") || undefined), touchAction: "none", userSelect: "none" }}>
      <div ref={box} onPointerDown={drag} style={{ position: "absolute", inset: 0, cursor: dragging ? "grabbing" : "grab", maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}>
        <div className="spb-anim" style={{ position: "absolute", left: 0, top: 0, width: fieldW, height: fieldH, transform: `translate(${pan.x}px, ${pan.y}px)`, transition: dragging ? "none" : `transform .55s ${SPRING}` }}>
          {bubbles.map((bb) => {
            const dx = bb.x + pan.x - viewW / 2;
            const dy = bb.y + pan.y - height / 2;
            const lens = lensScale(Math.hypot(dx, dy) / viewW);
            const picked = selected === bb.word;
            return (
              <div key={bb.word} data-spw-anim="pop" style={{ ...enter("pop", stagger(bb.t * 7)).style, position: "absolute", left: bb.x - diameter / 2, top: bb.y - diameter / 2, width: diameter, height: diameter }}>
              <button
                type="button"
                {...press}
                aria-pressed={picked}
                onClick={(e) => pick(bb.word, bb.x, bb.y, e.currentTarget)}
                style={{
                  all: "unset",
                  position: "absolute",
                  inset: 0,
                  width: diameter,
                  height: diameter,
                  borderRadius: cr("50%"),
                  background: hsb(bb.tone[0], bb.tone[1], bb.tone[2], tinted ? 0.24 : 1),
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  fontWeight: fw(600),
                  fontSize: ts(diameter * 0.15),
                  lineHeight: 1.15,
                  color: tinted ? "var(--ios-label)" : "rgba(0,0,0,.85)",
                  transform: `scale(${lens * (picked ? 1.12 : 1)})`,
                  transition: dragging ? `transform .08s linear, ${PRESS_TRANSITION}` : `transform .3s ${EASE_OUT}, ${PRESS_TRANSITION}`,
                  boxShadow: [tinted ? `inset 0 0 0 1.5px ${hsb(bb.tone[0], bb.tone[1], bb.tone[2])}` : "", picked ? "0 0 0 3px var(--ios-label)" : ""].filter(Boolean).join(", ") || undefined,
                  cursor: "pointer",
                }}
              >
                {bb.word}
              </button>
              </div>
            );
          })}
        </div>
      </div>
      {b(r.p, "controls") ? (
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
          <span style={glass}><Glyph name="xmark" size={20} /></span>
          <span style={glass}><Glyph name="magnifyingglass" size={20} /></span>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <button
          type="button"
          onClick={(e) => {
            if (link) {
              haptic("light", e.currentTarget);
              rt.act(link);
            } else if (!isLogged) {
              haptic("success", e.currentTarget);
              setLogged(selected);
            }
          }}
          className="spb-anim"
          {...press}
          style={{
            all: "unset",
            pointerEvents: selected ? "auto" : "none",
            cursor: "pointer",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderRadius: cr(999),
            background: ACCENT,
            color: "#fff",
            fontWeight: fw(600),
            fontSize: ts(17),
            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
            transform: selected ? "translateY(0)" : "translateY(90px)",
            opacity: selected ? 1 : 0,
            transition: `transform .28s ${EASE_OUT}, opacity .2s, ${PRESS_TRANSITION}`,
          }}
        >
          {link ? null : <Glyph name={isLogged ? "checkmark" : "plus"} size={17} strokeWidth={2.4} />}
          {isLogged ? "Logged" : prefix ? `${prefix} ${selected.toLowerCase()}` : selected}
        </button>
      </div>
    </Root>
  );
};
