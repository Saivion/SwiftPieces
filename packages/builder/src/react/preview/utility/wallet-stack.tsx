"use client";
// Wallet Stack in the Playground: the sample passes the generated screen declares, stacked by their header strips.
// Click a pass and it rises to the top and opens to its QR code while the others slide into a pile of narrowing
// slivers, then the glass close bubble buds out of its corner. Drag the open pass down past the threshold (the pile
// rises to meet it, with a tick as the pull crosses) or flick it, click the pile or the bubble, and it goes back.
// When the stack is taller than its frame it scrolls, and a pass opens at the top of what is showing. Mirrors
// WalletStack.swift: passes keep their stacking order, so the ones in front slide off and the ones behind slip under.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { house } from "../../../core/palette.js";
import { WALLET_DEFAULTS, walletCodes, walletOpenPass, walletPasses, type WalletPass } from "../../../definitions/utility/wallet-stack.js";
import { ACCENT, ACCENT_INK, cr, fillStyle, fw, houseVar, n, ts, useAxis, type Renderer } from "../env.js";
import { glassSurface } from "../glass.js";
import { SPRING, useDrag, useLive, useRuntime } from "../runtime.js";

const HEADER = 66;
const FIELDS = 58;
const CODE = 166;
const BUBBLE = 36;
/** The room above an open pass for its close bubble. */
const ROW = BUBBLE + 10;
const FRONT = 16;
const THRESHOLD = 110;
const INK = house.ink;
const MOTION = "@media (prefers-reduced-motion: reduce){[data-spws-motion]{transition-duration:.15s!important;transition-timing-function:ease-out!important}}";

/** The SF Symbols the sample passes use, drawn as SVG. */
const SYMBOLS: Record<string, { fill?: string; stroke?: string }> = {
  "building.columns.fill": { fill: "M12 2.4 2.8 7.3v1.9h18.4V7.3L12 2.4ZM4.8 10.6H7v6.6H4.8ZM8.9 10.6h2.2v6.6H8.9ZM12.9 10.6h2.2v6.6h-2.2ZM17 10.6h2.2v6.6H17ZM3 18.4h18v2.4H3Z" },
  "tram.fill": {
    fill: "M8 2.8h8A3.2 3.2 0 0 1 19.2 6v9.2a3.2 3.2 0 0 1-3.2 3.2H8a3.2 3.2 0 0 1-3.2-3.2V6A3.2 3.2 0 0 1 8 2.8ZM7.4 6.4v4.8h9.2V6.4ZM9.7 14.6a1.1 1.1 0 1 0-2.2 0 1.1 1.1 0 1 0 2.2 0ZM16.5 14.6a1.1 1.1 0 1 0-2.2 0 1.1 1.1 0 1 0 2.2 0Z",
    stroke: "M8.8 18.8 6.8 21.4M15.2 18.8l2 2.6",
  },
  "music.note": { fill: "M13.2 16.6a3.4 3.4 0 1 1-6.8 0 3.4 3.4 0 1 1 6.8 0ZM11.6 3.2h1.8v13.4h-1.8ZM13.4 3.2c2.6.9 4.6 2.6 4.6 5.6-1.2-1.7-2.8-2.6-4.6-2.9Z" },
  "ferry.fill": {
    fill: "M2.8 12.4h18.4l-2.5 5H5.3ZM6.4 8.2h11.2v3.2H6.4ZM9.6 4.6h4.8v2.8H9.6Z",
    stroke: "M3 20.6c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1",
  },
  "figure.climbing": { fill: "M15.6 4.4a2 2 0 1 1-4 0 2 2 0 1 1 4 0Z", stroke: "M13.2 7.6 11.4 13l3 3.6-1 4.4M13 8.6l4.2-2.4M12.4 10.2 8.2 8.4M11.4 13l-3.6 2.2-.8 3.6" },
  "books.vertical.fill": { fill: "M3.6 4h4.2v16H3.6ZM9 6h4.2v14H9ZM14.6 5.4l3.8-1.1 3.9 14.6-3.8 1.1Z" },
  "cup.and.saucer.fill": { fill: "M4.6 6.6h11.6v5.2a5.2 5.2 0 0 1-5.2 5.2H9.8a5.2 5.2 0 0 1-5.2-5.2Z", stroke: "M16.2 8.2h1.6a2.4 2.4 0 0 1 0 4.8h-1.6M3 19.8h15" },
  atom: { fill: "M13.4 12a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0Z", stroke: "M12 8.4c5 0 9 1.6 9 3.6s-4 3.6-9 3.6-9-1.6-9-3.6 4-3.6 9-3.6ZM8.9 10.2c2.5-4.3 5.9-7 7.6-6s1.2 5.3-1.3 9.6-5.9 7-7.6 6-1.2-5.3 1.3-9.6ZM15.1 10.2c2.5 4.3 3 8.6 1.3 9.6s-5.1-1.7-7.6-6-3-8.6-1.3-9.6 5.1 1.7 7.6 6Z" },
};

function PassSymbol({ name, size }: { name: string; size: number }) {
  const g = SYMBOLS[name];
  if (!g) return null;
  return (
    <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, display: "block", flex: "none" }}>
      {g.fill ? <path d={g.fill} fill="currentColor" fillRule="evenodd" /> : null}
      {g.stroke ? <path d={g.stroke} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

/** A QR code from its hex rows, one run of dark modules per rect, crisp at any size. */
function Qr({ rows, size }: { rows: string; size: number }) {
  const d = useMemo(() => {
    const lines = rows.split(" ");
    const count = lines.length;
    let out = "";
    lines.forEach((hex, y) => {
      const bits = parseInt(hex, 16);
      let x = 0;
      while (x < count) {
        if ((bits >> (count - 1 - x)) & 1) {
          let run = 1;
          while (x + run < count && (bits >> (count - 1 - x - run)) & 1) run++;
          out += `M${x} ${y}h${run}v1h-${run}z`;
          x += run;
        } else x++;
      }
    });
    return out;
  }, [rows]);
  return (
    <svg aria-hidden viewBox="0 0 21 21" shapeRendering="crispEdges" style={{ width: size, height: size, display: "block" }}>
      <path d={d} fill={INK} />
    </svg>
  );
}

const tintOf = (pass: WalletPass) => (pass.tint === "red" ? { fill: ACCENT, ink: ACCENT_INK } : { fill: house.blocks[pass.tint], ink: INK });

function Face({ pass, open, codes, radius }: { pass: WalletPass; open: boolean; codes: boolean; radius: number }) {
  const { fill, ink } = tintOf(pass);
  // Secondary ink is quieter on the pass, but full ink on the red one: even full ink on red is only about 4.6:1.
  const quiet = (alpha: number): CSSProperties => ({ color: ink, opacity: pass.tint === "red" ? 1 : alpha });
  const label: CSSProperties = { fontSize: ts(11), lineHeight: 1.2, letterSpacing: "0.06em", textTransform: "uppercase", ...quiet(0.64) };
  const value: CSSProperties = { fontSize: ts(17), lineHeight: 1.25, fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ position: "relative", borderRadius: cr(radius), background: fill, color: ink, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,.22)", fontWeight: fw(600) }}>
      <div style={{ height: HEADER, padding: "0 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 36, height: 36, borderRadius: cr(12), background: ink, color: fill, display: "grid", placeItems: "center", flex: "none" }}>
          <PassSymbol name={pass.symbol} size={19} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: ts(17), lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pass.title}</span>
          <span style={{ fontSize: ts(13), lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...quiet(0.7) }}>{pass.subtitle}</span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flex: "none", gap: 2 }}>
          <span style={label}>{pass.headerField[0]}</span>
          <span style={value}>{pass.headerField[1]}</span>
        </span>
      </div>
      <div style={{ height: FIELDS, padding: "6px 18px 0", display: "flex", justifyContent: pass.fields.length > 1 ? "space-between" : "flex-start", gap: 20 }}>
        {pass.fields.map(([l, v]) => (
          <span key={l} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={label}>{l}</span>
            <span style={{ ...value, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
          </span>
        ))}
      </div>
      {codes ? (
        <div data-spws-motion style={{ height: open ? CODE : 0, overflow: "hidden", transition: `height .5s ${SPRING}` }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span
              data-spws-motion
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 12, borderRadius: cr(12), background: "#FFFFFF",
                opacity: open ? 1 : 0, filter: `blur(${open ? 0 : 6}px)`,
                transition: open ? "opacity .3s ease-out .1s, filter .3s ease-out .1s" : "opacity .14s ease-out, filter .14s ease-out",
              }}
            >
              <Qr rows={pass.qr} size={104} />
              <span style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: ts(13), color: INK }}>{pass.code}</span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const renderer: Renderer = (r) => {
  const { p } = r;
  const rt = useRuntime();
  const axis = useAxis();
  const still = rt.still === true;
  const passes = useMemo(() => walletPasses(p), [p.set, p.count]); // eslint-disable-line react-hooks/exhaustive-deps
  const codes = walletCodes(p);
  const radius = Math.min(Math.max(Math.round(n(p, "cornerRadius") || WALLET_DEFAULTS.cornerRadius), 12), 34);
  const depthLimit = Math.min(Math.max(Math.round(n(p, "pileDepth") || WALLET_DEFAULTS.pileDepth), 1), 6);
  const [open, setOpen] = useLive<string | null>(walletOpenPass(p, passes));
  const [bubble, setBubble] = useState(open !== null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [anchor, setAnchor] = useState(0);
  const [last, setLast] = useState<string | null>(open);
  const scroller = useRef<HTMLDivElement | null>(null);
  const past = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // A pass opened by the props (the state picker) shows its bubble at once.
  useEffect(() => setBubble(open !== null), [p.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = HEADER + FIELDS + (codes ? CODE : 0);
  const restHeight = Math.max(passes.length - 1, 0) * HEADER + HEADER + FIELDS + 20;
  const height = Math.max(420, Math.min(restHeight, 560), ROW + full + 24 + 36);
  const openIndex = open ? passes.findIndex((x) => x.id === open) : -1;
  const pileCount = Math.min(passes.length - 1, depthLimit);
  const passTop = anchor + ROW;
  const pileTop = Math.max(anchor + height - Math.max(pileCount - 1, 0) * 10 - FRONT, passTop + full + 24);
  const lift = Math.min(Math.max(drag, 0) / THRESHOLD, 1) * 14;

  const present = (id: string, el: Element) => {
    if (open) return;
    setAnchor(scroller.current?.scrollTop ?? 0);
    setSettling(false);
    setOpen(id);
    setLast(id);
    setDrag(0);
    rt.haptic("light", el);
    clearTimeout(timer.current);
    // The bubble buds once the pass has nearly arrived.
    timer.current = setTimeout(() => setBubble(true), 160);
  };

  const putBack = (el: Element | null, fromDrag = false) => {
    if (!open) return;
    clearTimeout(timer.current);
    setBubble(false);
    setSettling(fromDrag);
    setOpen(null);
    setDrag(0);
    past.current = false;
    rt.haptic("light", el);
  };

  const onDrag = useDrag({
    axis: "y",
    onStart: () => setDragging(true),
    onMove: ({ dy, el }) => {
      const pulled = dy >= 0 ? dy : -(1 - 1 / ((-dy * 0.55) / 40 + 1)) * 40;
      setDrag(pulled);
      if (pulled > THRESHOLD !== past.current) {
        past.current = pulled > THRESHOLD;
        rt.haptic("selection", el);
      }
    },
    onEnd: ({ dy, vy, el }) => {
      setDragging(false);
      const carried = dy + (vy / 1000) * 99;
      if (dy > THRESHOLD || (carried > THRESHOLD && vy > 400)) putBack(el, true);
      else {
        past.current = false;
        setDrag(0);
      }
    },
  });

  const place = (i: number) => {
    if (openIndex < 0) return { y: i * HEADER, scale: 1, depth: 0 };
    if (i === openIndex) return { y: passTop + drag, scale: 1, depth: 0 };
    const depth = passes.filter((_, k) => k > i && k !== openIndex).length;
    const shown = Math.min(depth, Math.max(pileCount - 1, 0));
    return { y: pileTop + (pileCount - 1 - shown) * 10 - lift, scale: 1 - 0.04 * (shown + 1), depth };
  };

  const leader = open ?? last;
  const transition = (id: string, i: number, depth: number) => {
    if (still) return "none";
    if (dragging) return id === open ? "none" : "transform 0s";
    if (id === leader) return `transform ${settling ? ".55s" : ".5s"} ${SPRING}`;
    const order = open ? depth : passes.filter((x, k) => k < i && x.id !== leader).length;
    return `transform ${(0.5 + 0.04 * Math.min(order + 1, 5)).toFixed(2)}s ${SPRING}`;
  };

  const glass = glassSurface(r.scheme);
  const box: ReactNode = (
    <div
      ref={scroller}
      style={{ position: "absolute", inset: 0, overflowY: open || restHeight <= height ? "hidden" : "auto", overflowX: "hidden", scrollbarWidth: "none" }}
    >
      <div style={{ position: "relative", height: Math.max(restHeight, height) }}>
        {passes.map((pass, i) => {
          const { y, scale, depth } = place(i);
          const isOpen = pass.id === open;
          const others = open !== null && !isOpen;
          return (
            <div
              key={pass.id}
              data-spws-motion
              style={{
                position: "absolute", left: 0, right: 0, top: 0, zIndex: (i + 1) * 10,
                transform: `translateY(${y}px) scale(${scale})`, transformOrigin: "top center", transition: transition(pass.id, i, depth),
                pointerEvents: others ? "none" : "auto",
              }}
            >
              {/* The close bubble sits under the face, so at home it is hidden in the pass's corner: it buds up out of the
                  pass and slips back behind it to melt home. */}
              {pass.id === leader ? (
                <button
                  type="button"
                  aria-label="Done"
                  onClick={(e) => putBack(e.currentTarget)}
                  data-spws-motion
                  style={{
                    position: "absolute", right: 0, top: -ROW, width: BUBBLE, height: BUBBLE, padding: 0, border: 0, borderRadius: "50%", zIndex: 0,
                    display: "grid", placeItems: "center", color: houseVar("text"), cursor: "pointer", ...glass,
                    transform: bubble && isOpen ? "none" : `translateY(${ROW + BUBBLE / 2}px) scale(.72)`,
                    transition: still ? "none" : bubble && isOpen ? "transform .62s cubic-bezier(.34,1.3,.5,1)" : "transform .5s cubic-bezier(.32,.72,0,1)",
                  }}
                >
                  <svg aria-hidden viewBox="0 0 24 24" style={{ width: 15, height: 15, opacity: bubble && isOpen ? 1 : 0, transition: "opacity .2s" }}>
                    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
              <div
                role={isOpen ? undefined : "button"}
                aria-label={isOpen ? undefined : `${pass.title}, ${pass.subtitle}, ${pass.headerField[0]}, ${pass.headerField[1]}`}
                onClick={isOpen ? undefined : (e: MouseEvent<HTMLDivElement>) => present(pass.id, e.currentTarget)}
                onPointerDown={isOpen ? onDrag : undefined}
                style={{ position: "relative", zIndex: 1, cursor: isOpen ? "grab" : "pointer", touchAction: isOpen ? "none" : "auto" }}
              >
                <Face pass={pass} open={isOpen} codes={codes} radius={radius} />
              </div>
            </div>
          );
        })}
        {open && pileCount > 0 ? (
          <button
            type="button"
            aria-label="Other passes"
            onClick={(e) => putBack(e.currentTarget)}
            style={{ position: "absolute", left: 0, right: 0, top: pileTop - 8, height: height - (pileTop - anchor) + 16, zIndex: 100, background: "transparent", border: 0, cursor: "pointer" }}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div {...r.box} style={{ ...r.box.style, ...fillStyle(r.fill, axis), position: "relative", height, overflow: "hidden", fontFamily: "inherit" }}>
      <style>{MOTION}</style>
      {box}
    </div>
  );
};
