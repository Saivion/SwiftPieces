"use client";
// Web renderers for the extra native SwiftUI blocks (definitions/native.ts). Each one behaves like
// its SwiftUI counterpart on an iPhone: sliders drag, steppers count, pickers and menus open real
// popovers over the phone, carousels page under the finger, charts answer a touch. Same props,
// same defaults, same layout rules as the emitter.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { list } from "../../core/swift.js";
import { ARTS, ASPECTS, CAROUSEL_ART_TOP, PAGE_HUE, chartLabels, chartValues, menuSymbol, uniqueList } from "../../definitions/native.js";
import { ArtworkSvg } from "./app-pieces/artwork.js";
import { ARTWORK_INK, artworkGround, artworkGrounds, artworkInset, isArtwork } from "../../definitions/app-pieces/artwork.js";
import { Glyph } from "../icons.js";
import { b, fillStyle, font, n, paint, s, useAxis, type Renderer, type Scheme, cr, ff, fw, ts } from "./env.js";
import { BOUNCE, SPRING, useChoice, useDrag, useLive, useRuntime, useTap } from "./runtime.js";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const corner = (r: number) => cr(r) as string;
const space = (v: number) => `calc(${v}px * var(--spb-space, 1))`;
const ROUNDED = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const SCREEN_BG = "var(--spb-theme-bg, var(--ios-bg))";
const inkOn = (id: string) => (id === "white" || id === "yellow" ? "#000" : "#fff");

/** Keyframes and pseudo-element rules the renderers share. Rendered by the components that use them. */
const CSS = `
@keyframes spbn-spin { to { transform: rotate(360deg); } }
@keyframes spbn-slide { from { transform: translateX(-100%); } to { transform: translateX(290%); } }
@keyframes spbn-pop { 0% { transform: scale(.97); } 45% { transform: scale(1.018); } 100% { transform: scale(1); } }
@keyframes spbn-up { from { transform: translateY(45%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes spbn-down { from { transform: translateY(-45%); opacity: 0; } to { transform: none; opacity: 1; } }
.spbn-input { all: unset; flex: 1; min-width: 0; font-size: 17px; line-height: 22px; color: var(--ios-label); caret-color: var(--ios-accent); }
.spbn-input::placeholder { color: var(--ios-label2); opacity: 1; }
.spbn-row { transition: background-color .15s; }
.spbn-row:active { background: var(--ios-fill2); }
@media (hover: hover) { .spbn-row:hover { background: var(--ios-fill4); } }
@media (prefers-reduced-motion: reduce) { .spbn-loop { animation-duration: 2.8s !important; } }
`;
const Styles = () => <style>{CSS}</style>;

/** The dip a button takes under the finger: in fast, out with a little spring. */
function usePress(enabled = true, depth = 0.96) {
  const [down, setDown] = useState(false);
  const up = () => setDown(false);
  const on = enabled
    ? { onPointerDown: (e: ReactPointerEvent) => e.button === 0 && setDown(true), onPointerUp: up, onPointerLeave: up, onPointerCancel: up }
    : {};
  const style: CSSProperties = enabled
    ? { transform: `scale(${down ? depth : 1})`, transition: down ? "transform .12s ease-out" : `transform .5s ${BOUNCE}`, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }
    : {};
  return { on, style, down };
}

/** The art gradient with a soft light top-leading and shade bottom-trailing. */
export function artBackground(id: string): string {
  const a = ARTS[id] ?? ARTS.sunset;
  // Solid house fills stay flat, as the Swift draws them: no light and shade on top.
  if (a.solid) return `linear-gradient(135deg, ${a.stops[0]} 0%, ${a.stops[1]} 50%, ${a.stops[2]} 100%)`;
  return [
    "radial-gradient(120% 85% at 12% 8%, rgba(255,255,255,.42), rgba(255,255,255,0) 55%)",
    "radial-gradient(90% 70% at 92% 100%, rgba(0,0,0,.24), rgba(0,0,0,0) 62%)",
    `linear-gradient(135deg, ${a.stops[0]} 0%, ${a.stops[1]} 50%, ${a.stops[2]} 100%)`,
  ].join(", ");
}

/** A drawing (definitions/app-pieces/artwork.ts) filling a photo spot, inset as the Swift pads it. */
function ArtworkFill({ id }: { id: string }) {
  const i = artworkInset(id);
  return (
    <span style={{ position: "absolute", top: i.top, left: i.side, right: i.side, bottom: i.bottom }}>
      <ArtworkSvg id={id} />
    </span>
  );
}

/** chevron.up.chevron.down, which the icon set does not draw. */
const UpDown = ({ size = 13 }: { size?: number }) => (
  <svg width={Math.round(size * 0.66)} height={size} viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none", display: "block" }}>
    <path d="M2 6.2 5 3.2l3 3M2 9.8l3 3 3-3" />
  </svg>
);

// ---------------------------------------------------------------- Popover menu (Picker, Menu)

type Anchor = { x: number; y: number; w: number; h: number; W: number; H: number };
type MenuEntry = { label: string; icon?: string | null; checked?: boolean; destructive?: boolean; divider?: boolean };

/** Measures a control against the phone's overlay layer, in points. */
function useAnchor() {
  const rt = useRuntime();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = (el: HTMLElement | null) => {
    const ov = rt.overlay();
    if (!el || !ov) return false;
    const k = rt.scale() || 1;
    const a = el.getBoundingClientRect();
    const o = ov.getBoundingClientRect();
    const W = o.width / k || ov.offsetWidth || 390;
    const H = o.height / k || ov.offsetHeight || 844;
    setAnchor({ x: (a.left - o.left) / k, y: (a.top - o.top) / k, w: a.width / k, h: a.height / k, W, H });
    return true;
  };
  return { anchor, open, close: () => setAnchor(null), layer: rt.overlay() };
}

const MENU_W = 250;
const ROW_H = 44;

/**
 * An iOS menu: a blurred panel that blooms from the control, rows you tap to choose, and a tap
 * anywhere else to dismiss. `checks` reserves the leading checkmark column (a Picker's menu).
 */
function Popover({ anchor, items, checks, scheme, onPick, onClose }: { anchor: Anchor; items: MenuEntry[]; checks: boolean; scheme: Scheme; onPick(index: number, el: Element): void; onClose(): void }) {
  const [shown, setShown] = useState(false);
  const closing = useRef(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setShown(true))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  const dismiss = () => {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    window.setTimeout(onClose, 220);
  };
  const rows = items.filter((i) => !i.divider).length;
  const height = rows * ROW_H + items.filter((i) => i.divider).length * 9 + 12;
  const trailing = anchor.x + anchor.w / 2 > anchor.W / 2;
  const left = clamp(trailing ? anchor.x + anchor.w - MENU_W : anchor.x, 12, anchor.W - MENU_W - 12);
  const below = anchor.y + anchor.h + 8 + height < anchor.H - 34;
  const top = below ? anchor.y + anchor.h + 8 : Math.max(54, anchor.y - 8 - height);
  const originX = clamp(anchor.x + anchor.w / 2 - left, 0, MENU_W);
  const red = paint("red", scheme);
  let row = -1;
  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 60, pointerEvents: "auto" }}
      // React events bubble through portals to the control that opened the menu; stop them here.
      onPointerDown={(e) => {
        e.stopPropagation();
        dismiss();
      }}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Styles />
      <div
        role="menu"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute", left, top, width: MENU_W, padding: "6px 0", borderRadius: cr(22), overflow: "hidden",
          background: scheme === "dark" ? "rgba(40,40,42,.78)" : "rgba(252,252,252,.8)",
          backdropFilter: "blur(28px) saturate(1.8)", WebkitBackdropFilter: "blur(28px) saturate(1.8)",
          boxShadow: scheme === "dark" ? "0 16px 48px rgba(0,0,0,.5), inset 0 0 0 .5px rgba(255,255,255,.12)" : "0 16px 48px rgba(0,0,0,.18), 0 0 0 .5px rgba(0,0,0,.06)",
          transformOrigin: `${originX}px ${below ? 0 : height}px`,
          transform: shown ? "scale(1)" : "scale(.35)", opacity: shown ? 1 : 0,
          transition: shown ? `transform .42s ${BOUNCE}, opacity .18s ease-out` : "transform .22s ease-in, opacity .2s ease-in",
          fontSize: ts(17), lineHeight: "22px", color: "var(--ios-label)",
        }}
      >
        {items.map((it, i) => {
          if (it.divider) return <div key={`d${i}`} style={{ height: 1, margin: "4px 16px", background: "var(--ios-sep)" }} />;
          const index = ++row;
          return (
            <div
              key={`${it.label}${i}`}
              role="menuitem"
              className="spbn-row"
              onClick={(e) => {
                onPick(index, e.currentTarget);
                dismiss();
              }}
              style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 10, padding: checks ? "0 16px 0 12px" : "0 16px", cursor: "pointer", color: it.destructive ? red : undefined }}
            >
              {checks ? <span style={{ width: 18, flex: "none", display: "grid", placeItems: "center" }}>{it.checked ? <Glyph name="checkmark" size={15} strokeWidth={2.6} /> : null}</span> : null}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
              {it.icon ? <Glyph name={it.icon} size={19} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Image

const ImageView: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const linked = s(p, "link") !== "";
  const tap = useTap(s(p, "link"));
  const press = usePress(linked, 0.97);
  const title = s(p, "title").trim();
  const caption = s(p, "caption").trim();
  const sym = s(p, "symbol");
  const r = corner(n(p, "radius"));
  return (
    <div
      {...box}
      {...press.on}
      onClick={linked ? (e) => tap(e) : undefined}
      role={linked ? "button" : "img"}
      style={{
        ...box.style, position: "relative", overflow: "hidden", borderRadius: cr(r), isolation: "isolate",
        aspectRatio: (ASPECTS[s(p, "aspect")] ?? ASPECTS["4:3"]).css, background: isArtwork(s(p, "art")) ? artworkGround(s(p, "art")) : artBackground(s(p, "art")),
        minWidth: 60, ...fillStyle(fill, axis), ...press.style,
      }}
    >
      {isArtwork(s(p, "art")) ? <ArtworkFill id={s(p, "art")} /> : sym !== "none" ? (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.9)", filter: "drop-shadow(0 2px 8px rgba(0,0,0,.18))" }}>
          <Glyph name={sym} size={44} strokeWidth={1.6} />
        </span>
      ) : null}
      {title || caption ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingTop: 40, color: "#fff", display: "flex", flexDirection: "column", gap: 2, background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.5))" }}>
          {title ? <span style={{ ...font("headline"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span> : null}
          {caption ? <span style={{ ...font("subheadline"), opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{caption}</span> : null}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- Avatar

const Avatar: Renderer = ({ p, box, scheme }) => {
  const size = clamp(n(p, "size"), 24, 120);
  const id = s(p, "color");
  const c = paint(id, scheme);
  const sym = s(p, "symbol");
  const initials = s(p, "initials").trim().slice(0, 3);
  const status = s(p, "status");
  const dot = Math.max(8, Math.round(size * 0.24));
  return (
    <div
      {...box}
      role="img"
      aria-label={initials || "Avatar"}
      style={{
        ...box.style, position: "relative", width: size, height: size, borderRadius: cr("50%"), flex: "none",
        display: "grid", placeItems: "center", color: inkOn(id),
        background: `linear-gradient(180deg, color-mix(in srgb, ${c} 80%, #fff), ${c})`,
      }}
    >
      {sym !== "none" || !initials ? (
        <Glyph name={sym !== "none" ? sym : "person"} size={Math.round(size * 0.46)} strokeWidth={2.2} />
      ) : (
        <span style={{ fontFamily: ff(ROUNDED), fontWeight: fw(600), fontSize: ts(Math.round(size * 0.4)), lineHeight: 1, letterSpacing: "0.01em" }}>{initials}</span>
      )}
      {status !== "none" ? (
        <span
          style={{
            position: "absolute", right: -2, bottom: -2, width: dot + 4, height: dot + 4, borderRadius: cr("50%"),
            background: SCREEN_BG, display: "grid", placeItems: "center",
          }}
        >
          <span style={{ width: dot, height: dot, borderRadius: cr("50%"), background: paint(status === "online" ? "green" : "red", scheme) }} />
        </span>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- Search field

const CANCEL_W = 64;

const SearchField: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const [query, setQuery] = useLive(s(p, "text"));
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cancel = b(p, "showsCancel") && focused;
  return (
    <div {...box} style={{ ...box.style, position: "relative", display: "flex", alignItems: "center", minHeight: 44, ...fillStyle(fill, axis) }}>
      <Styles />
      <label
        style={{
          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", cursor: "text",
          borderRadius: corner(10), background: "var(--ios-fill)", color: "var(--ios-label2)",
          marginRight: cancel ? CANCEL_W : 0, transition: `margin-right .38s ${SPRING}`,
        }}
      >
        <Glyph name="magnifyingglass" size={17} strokeWidth={2.2} />
        <input
          ref={input}
          className="spbn-input"
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={s(p, "placeholder")}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        {query ? (
          <span
            role="button"
            aria-label="Clear"
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              setQuery("");
              rt.haptic("light", e.currentTarget);
              input.current?.focus();
            }}
            style={{ width: 17, height: 17, borderRadius: cr("50%"), flex: "none", display: "grid", placeItems: "center", background: "var(--ios-label3)", color: "var(--ios-bg)", cursor: "pointer" }}
          >
            <Glyph name="xmark" size={10} strokeWidth={3.4} />
          </span>
        ) : null}
      </label>
      {b(p, "showsCancel") ? (
        <span
          role="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            setQuery("");
            rt.haptic("light", e.currentTarget);
            input.current?.blur();
          }}
          style={{
            position: "absolute", right: 0, width: CANCEL_W - 8, textAlign: "right", fontSize: ts(17), lineHeight: "44px", color: "var(--ios-accent)", cursor: "pointer",
            transform: cancel ? "none" : "translateX(24px)", opacity: cancel ? 1 : 0, pointerEvents: cancel ? "auto" : "none",
            transition: `transform .38s ${SPRING}, opacity .2s ease`,
          }}
        >
          Cancel
        </span>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- Slider

const KNOB_W = 38;
const KNOB_H = 24;

const Slider: Renderer = ({ p, box, fill, scheme }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const step = n(p, "step");
  const snap = (v: number) => clamp(step > 0 ? Math.round(v / step) * step : v, 0, 100);
  const [value, setValue] = useLive(snap(n(p, "value")));
  const [active, setActive] = useState(false);
  const [jump, setJump] = useState(false);
  const moveTo = (x: number, el: HTMLElement, animate: boolean) => {
    const w = el.offsetWidth;
    const v = snap(((x - KNOB_W / 2) / Math.max(1, w - KNOB_W)) * 100);
    setJump(animate);
    if (v === value) return;
    if (step > 0) rt.haptic("selection", el);
    setValue(v);
  };
  const onDown = useDrag({
    slop: 0,
    onStart: (i) => {
      setActive(true);
      moveTo(i.x, i.el, true);
    },
    onMove: (i) => moveTo(i.x, i.el, false),
    onEnd: () => {
      setActive(false);
      setJump(false);
    },
  });
  const tint = paint(s(p, "tint"), scheme);
  const label = s(p, "label").trim();
  const lo = s(p, "minIcon");
  const hi = s(p, "maxIcon");
  const frac = value / 100;
  const ease = jump ? `.35s ${SPRING}` : "0s";
  return (
    <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", gap: 8, color: "var(--ios-label)", ...fillStyle(fill, axis) }}>
      {label || b(p, "showsValue") ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: ts(17), lineHeight: "22px" }}>
          <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
          {b(p, "showsValue") ? <span style={{ color: "var(--ios-label2)", fontVariantNumeric: "tabular-nums" }}>{Math.round(value)}</span> : null}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {lo !== "none" ? <span style={{ color: "var(--ios-label2)" }}><Glyph name={lo} size={19} /></span> : null}
        <div
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value)}
          aria-label={label || "Value"}
          onPointerDown={onDown}
          style={{ position: "relative", flex: 1, minWidth: 0, height: 44, touchAction: "pan-y", cursor: "pointer" }}
        >
          <span style={{ position: "absolute", left: 0, right: 0, top: 19, height: 6, borderRadius: cr(3), background: "var(--ios-fill2)", overflow: "hidden" }}>
            <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `calc(${KNOB_W / 2}px + (100% - ${KNOB_W}px) * ${frac})`, background: tint, borderRadius: cr(3), transition: `width ${ease}` }} />
          </span>
          <span
            style={{
              position: "absolute", top: 10, left: `calc((100% - ${KNOB_W}px) * ${frac})`, width: KNOB_W, height: KNOB_H, borderRadius: cr(KNOB_H / 2),
              background: active ? "rgba(255,255,255,.72)" : "#fff",
              boxShadow: active ? "0 0 0 .5px rgba(0,0,0,.08), 0 8px 22px rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.8)" : "0 0 0 .5px rgba(0,0,0,.04), 0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.16)",
              backdropFilter: active ? "blur(3px)" : undefined,
              transform: active ? "scale(1.22, 1.3)" : "scale(1)",
              transition: `left ${ease}, transform .35s ${BOUNCE}, background-color .2s`,
            }}
          />
        </div>
        {hi !== "none" ? <span style={{ color: "var(--ios-label2)" }}><Glyph name={hi} size={19} /></span> : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Stepper

const Stepper: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const lo = Math.min(n(p, "min"), n(p, "max") - 1);
  const hi = Math.max(n(p, "max"), lo + 1);
  const [value, setValue] = useLive(clamp(Math.round(n(p, "value")), lo, hi));
  const current = useRef(value);
  current.current = value;
  const [dir, setDir] = useState(0);
  const [held, setHeld] = useState(0);
  const timers = useRef<{ t?: number; i?: number }>({});
  const stop = () => {
    window.clearTimeout(timers.current.t);
    window.clearInterval(timers.current.i);
    timers.current = {};
    setHeld(0);
  };
  useEffect(() => stop, []);
  const bump = (d: number, el: Element) => {
    const next = clamp(current.current + d, lo, hi);
    if (next === current.current) return false;
    current.current = next;
    setDir(d);
    setValue(next);
    rt.haptic(d > 0 ? "increase" : "decrease", el);
    return true;
  };
  const half = (d: number) => {
    const disabled = d < 0 ? value <= lo : value >= hi;
    return {
      role: "button",
      "aria-label": d < 0 ? "Decrement" : "Increment",
      "aria-disabled": disabled,
      onPointerDown: (e: ReactPointerEvent<HTMLSpanElement>) => {
        if (e.button !== 0 || disabled) return;
        const el = e.currentTarget;
        setHeld(d);
        bump(d, el);
        // Holding repeats, like UIStepper's autorepeat.
        timers.current.t = window.setTimeout(() => {
          timers.current.i = window.setInterval(() => {
            if (!bump(d, el)) stop();
          }, 110);
        }, 450);
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      style: {
        flex: 1, height: "100%", display: "grid", placeItems: "center", cursor: disabled ? "default" : "pointer",
        color: disabled ? "var(--ios-label3)" : "var(--ios-label)", background: held === d ? "var(--ios-fill2)" : "transparent",
        transition: "background-color .15s, color .15s",
      } as CSSProperties,
    };
  };
  const label = s(p, "label").trim();
  return (
    <div {...box} style={{ ...box.style, display: "flex", alignItems: "center", gap: 12, minHeight: 44, fontSize: ts(17), lineHeight: "22px", color: "var(--ios-label)", ...fillStyle(fill, axis) }}>
      <Styles />
      <span style={{ flex: 1, minWidth: 0 }}>
        {label ? `${label}: ` : ""}
        <span key={value} style={{ display: "inline-block", fontVariantNumeric: "tabular-nums", animation: dir ? `${dir > 0 ? "spbn-up" : "spbn-down"} .32s ${SPRING}` : undefined }}>{value}</span>
      </span>
      <span style={{ display: "flex", alignItems: "center", width: 94, height: 32, borderRadius: cr(16), overflow: "hidden", background: "var(--ios-fill)", flex: "none", touchAction: "manipulation" }}>
        <span {...half(-1)}><Glyph name="minus" size={17} strokeWidth={2.3} /></span>
        <span style={{ width: 1, height: 18, background: "var(--ios-sep)", flex: "none" }} />
        <span {...half(1)}><Glyph name="plus" size={17} strokeWidth={2.3} /></span>
      </span>
    </div>
  );
};

// ---------------------------------------------------------------- Progress

/** The activity indicator: eight spokes turning a notch at a time. */
function Spinner({ size = 22, color }: { size?: number; color: string }) {
  return (
    <svg className="spbn-loop" width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ display: "block", color, animation: "spbn-spin .9s steps(8) infinite" }}>
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1="12" y1="2.8" x2="12" y2="7.2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity={0.2 + (i / 7) * 0.8} transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}

/** A value that eases in from zero on first paint, then follows its prop. */
function useGrown(): boolean {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setGrown(true))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  return grown;
}

const Progress: Renderer = ({ p, box, fill, scheme }) => {
  const axis = useAxis();
  const grown = useGrown();
  const tintId = s(p, "tint");
  const tint = paint(tintId, scheme);
  const v = clamp(n(p, "value"), 0, 100);
  const label = s(p, "label").trim();
  const loading = b(p, "indeterminate");
  if (s(p, "style") === "circular") {
    const ring = 50;
    const stroke = 6;
    const radius = (ring - stroke) / 2;
    const length = 2 * Math.PI * radius;
    return (
      <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, ...fillStyle(fill, axis) }}>
        <Styles />
        {loading ? (
          <Spinner color={tintId === "accent" ? "var(--ios-label2)" : tint} />
        ) : (
          <span style={{ position: "relative", width: ring, height: ring, display: "grid", placeItems: "center" }}>
            <svg width={ring} height={ring} viewBox={`0 0 ${ring} ${ring}`} aria-hidden style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
              <circle cx={ring / 2} cy={ring / 2} r={radius} fill="none" stroke="var(--ios-fill2)" strokeWidth={stroke} />
              <circle
                cx={ring / 2} cy={ring / 2} r={radius} fill="none" stroke={tint} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={length} strokeDashoffset={length * (1 - (grown ? v : 0) / 100)}
                style={{ transition: `stroke-dashoffset .8s ${SPRING}` }}
              />
            </svg>
            <span style={{ fontSize: ts(13), fontWeight: fw(600), fontVariantNumeric: "tabular-nums", color: "var(--ios-label)" }}>{Math.round(v)}%</span>
          </span>
        )}
        {label ? <span style={{ ...font(loading ? "subheadline" : "footnote"), color: "var(--ios-label2)" }}>{label}</span> : null}
      </div>
    );
  }
  return (
    <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", gap: 8, ...fillStyle(fill, axis) }}>
      <Styles />
      {label ? <span style={{ fontSize: ts(17), lineHeight: "22px", color: "var(--ios-label)" }}>{label}</span> : null}
      <span role="progressbar" aria-valuenow={loading ? undefined : Math.round(v)} style={{ position: "relative", height: 4, borderRadius: cr(2), overflow: "hidden", background: "var(--ios-fill2)" }}>
        {loading ? (
          <span className="spbn-loop" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "35%", borderRadius: cr(2), background: tint, animation: "spbn-slide 1.4s cubic-bezier(.45,0,.25,1) infinite" }} />
        ) : (
          <span style={{ position: "absolute", inset: 0, background: tint, transformOrigin: "0 50%", transform: `scaleX(${grown ? v / 100 : 0})`, transition: `transform .8s ${SPRING}` }} />
        )}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------- Picker

const Picker: Renderer = ({ p, box, fill, scheme }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const items = uniqueList(p.options, 10);
  const safe = items.length ? items : ["Option"];
  const [sel, setSel] = useLive(clamp(Math.round(n(p, "selected")), 0, safe.length - 1));
  const current = Math.min(sel, safe.length - 1);
  const menu = useAnchor();
  const control = useRef<HTMLSpanElement>(null);
  const press = usePress(true, 1);
  const label = s(p, "label").trim();
  return (
    <div {...box} style={{ ...box.style, display: "flex", alignItems: "center", gap: 12, minHeight: 44, fontSize: ts(17), lineHeight: "22px", color: "var(--ios-label)", ...fillStyle(fill, axis) }}>
      {label ? <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span> : null}
      <span
        ref={control}
        role="button"
        aria-haspopup="menu"
        {...press.on}
        onClick={() => {
          // Without an overlay layer (a static host), tapping steps through the options.
          if (!menu.open(control.current)) setSel((current + 1) % safe.length);
        }}
        style={{
          display: "flex", alignItems: "center", gap: 6, color: "var(--ios-accent)", cursor: "pointer", minHeight: 44, flex: "none", maxWidth: "70%",
          opacity: press.down || menu.anchor ? 0.35 : 1, transition: press.down ? "none" : "opacity .25s",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{safe[current]}</span>
        <UpDown />
      </span>
      {menu.anchor && menu.layer
        ? createPortal(
            <Popover
              anchor={menu.anchor}
              scheme={scheme}
              checks
              items={safe.map((o, i) => ({ label: o, checked: i === current }))}
              onPick={(i, el) => {
                if (i !== current) rt.haptic("selection", el);
                setSel(i);
              }}
              onClose={menu.close}
            />,
            menu.layer,
          )
        : null}
    </div>
  );
};

// ---------------------------------------------------------------- Menu

const Menu: Renderer = ({ p, box, scheme }) => {
  const rt = useRuntime();
  const menu = useAnchor();
  const face = useRef<HTMLDivElement>(null);
  const press = usePress(true, 1);
  const items = list(p.items, 8);
  const dest = s(p, "destructive").trim();
  const entries: MenuEntry[] = items.map((it) => ({ label: it, icon: menuSymbol(it) }));
  if (dest) {
    if (entries.length) entries.push({ label: "", divider: true });
    entries.push({ label: dest, icon: menuSymbol(dest) ?? "trash", destructive: true });
  }
  if (!entries.length) entries.push({ label: "Action" });
  const label = s(p, "label").trim();
  const ic = s(p, "icon");
  return (
    <div
      {...box}
      ref={face}
      role="button"
      aria-haspopup="menu"
      aria-label={label || "More"}
      {...press.on}
      onClick={() => menu.open(face.current)}
      style={{
        ...box.style, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, minWidth: 44,
        color: "var(--ios-accent)", fontSize: ts(17), lineHeight: "22px", cursor: "pointer",
        opacity: press.down || menu.anchor ? 0.35 : 1, transition: press.down ? "none" : "opacity .25s",
      }}
    >
      {ic !== "none" ? <Glyph name={ic} size={label ? 19 : 23} /> : null}
      {label || ic === "none" ? <span>{label || "More"}</span> : null}
      {menu.anchor && menu.layer
        ? createPortal(
            <Popover anchor={menu.anchor} scheme={scheme} checks={false} items={entries} onPick={(_, el) => rt.haptic("light", el)} onClose={menu.close} />,
            menu.layer,
          )
        : null}
    </div>
  );
};

// ---------------------------------------------------------------- Disclosure group

const Disclosure: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const [open, setOpen] = useLive(b(p, "expanded"));
  const press = usePress(true, 1);
  const motion = `.42s ${SPRING}`;
  return (
    <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", color: "var(--ios-label)", ...fillStyle(fill, axis) }}>
      <div
        role="button"
        aria-expanded={open}
        {...press.on}
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, fontSize: ts(17), lineHeight: "22px", cursor: "pointer", opacity: press.down ? 0.5 : 1, transition: "opacity .2s" }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>{s(p, "title") || "Details"}</span>
        <span style={{ color: "var(--ios-accent)", transform: `rotate(${open ? 90 : 0}deg)`, transition: `transform ${motion}` }}>
          <Glyph name="chevron.right" size={15} strokeWidth={2.6} />
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows ${motion}` }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ ...font("subheadline"), color: "var(--ios-label2)", paddingBottom: 10, opacity: open ? 1 : 0, transform: open ? "none" : "translateY(-6px)", transition: `opacity .3s ease, transform ${motion}` }}>
            {s(p, "text")}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Page carousel

const PageCarousel: Renderer = ({ p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const titles = list(p.titles, 5);
  const pages = titles.length ? titles : ["Page"];
  const last = pages.length - 1;
  const [page, setPage] = useState(0);
  const current = Math.min(page, last);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const go = (next: number, el: Element) => {
    const to = clamp(next, 0, last);
    if (to !== current) rt.haptic("selection", el);
    setPage(to);
  };
  const onDown = useDrag({
    axis: "x",
    onStart: () => setDragging(true),
    onMove: (i) => setDx((current === 0 && i.dx > 0) || (current === last && i.dx < 0) ? i.dx * 0.35 : i.dx),
    onEnd: (i) => {
      const w = i.el.offsetWidth || 1;
      let next = current;
      if (Math.abs(i.vx) > 380) next = current + (i.vx < 0 ? 1 : -1);
      else if (Math.abs(i.dx) > w / 2) next = current + (i.dx < 0 ? 1 : -1);
      setDragging(false);
      setDx(0);
      go(next, i.el);
    },
  });
  const dots = b(p, "dots");
  const height = clamp(n(p, "height"), 160, 560);
  return (
    <div
      {...box}
      onPointerDown={onDown}
      style={{ ...box.style, position: "relative", height, overflow: "hidden", borderRadius: corner(n(p, "radius")), touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab", userSelect: "none", isolation: "isolate", ...fillStyle(fill, axis) }}
    >
      <div style={{ display: "flex", height: "100%", transform: `translateX(calc(${-current * 100}% + ${dx}px))`, transition: dragging ? "none" : `transform .55s ${SPRING}` }}>
        {pages.map((title, i) => (
          <div key={`${title}${i}`} aria-hidden={i !== current} style={{ position: "relative", flex: "0 0 100%", height: "100%" }}>
            {isArtwork(s(p, "art")) ? (
              <span style={{ position: "absolute", inset: 0, background: artworkGrounds(s(p, "art"), Math.min(pages.length, 6))[i % Math.min(pages.length, 6)] }}>
                <span style={{ position: "absolute", top: CAROUSEL_ART_TOP, left: 8, right: 8, bottom: 0 }}><ArtworkSvg id={s(p, "art")} /></span>
              </span>
            ) : (
              <span style={{ position: "absolute", inset: 0, background: artBackground(s(p, "art")), filter: i ? `hue-rotate(${i * PAGE_HUE}deg)` : undefined }} />
            )}
            {isArtwork(s(p, "art")) ? (
              <span style={{ position: "absolute", left: 0, right: 0, top: 0, padding: 20, ...font("title3", 700), color: ARTWORK_INK }}>{title}</span>
            ) : (
              <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 24, paddingBottom: dots ? 44 : 24, ...font("title2", 700), color: "#fff", textShadow: "0 1px 12px rgba(0,0,0,.18)" }}>{title}</span>
            )}
          </div>
        ))}
      </div>
      {dots && pages.length > 1 ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", justifyContent: "center" }}>
          {pages.map((_, i) => (
            <span
              key={i}
              role="button"
              aria-label={`Page ${i + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => go(i, e.currentTarget)}
              style={{ width: 16, height: 20, display: "grid", placeItems: "center", cursor: "pointer" }}
            >
              <span style={{ width: 7, height: 7, borderRadius: cr("50%"), background: "#fff", opacity: i === current ? 1 : 0.4, transform: `scale(${i === current ? 1 : 0.9})`, transition: "opacity .3s, transform .3s" }} />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- Bar chart

function niceScale(max: number): { top: number; step: number } {
  const raw = (max || 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  return { top: Math.max(step, Math.ceil(max / step) * step), step };
}

const fmtNum = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

const Chart: Renderer = ({ p, box, fill, scheme }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const grown = useGrown();
  const vals = chartValues(p.values);
  const labels = chartLabels(p.labels, vals.length);
  const [sel, setSel] = useLive(Math.round(n(p, "highlight")));
  const current = sel >= 0 && sel < vals.length ? sel : -1;
  const startedOn = useRef(-1);
  const { top, step } = niceScale(Math.max(...vals));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const AXIS = 30;
  const height = clamp(n(p, "height"), 120, 320);
  const plot = height - 22;
  const pick = (x: number, el: HTMLElement) => {
    const w = Math.max(1, el.offsetWidth);
    const i = clamp(Math.floor((x / w) * vals.length), 0, vals.length - 1);
    if (i !== current) {
      rt.haptic("selection", el);
      setSel(i);
    }
    return i;
  };
  const onDown = useDrag({
    slop: 0,
    onStart: (i) => {
      startedOn.current = current;
      const hit = pick(i.x, i.el);
      if (hit === startedOn.current) startedOn.current = -2 - hit;
    },
    onMove: (i) => pick(i.x, i.el),
    onEnd: (i) => {
      // Tapping the selected bar again clears the selection.
      if (startedOn.current <= -2 && Math.abs(i.dx) < 4 && -2 - startedOn.current === current) setSel(-1);
    },
  });
  const tint = paint(s(p, "tint"), scheme);
  return (
    <div {...box} style={{ ...box.style, position: "relative", height, color: "var(--ios-label2)", userSelect: "none", ...fillStyle(fill, axis) }}>
      {ticks.map((t) => (
        <div key={t} style={{ position: "absolute", left: 0, right: 0, top: plot - (t / top) * plot, display: "flex", alignItems: "center", gap: 6, height: 0 }}>
          <span style={{ flex: 1, height: 1, background: "var(--ios-sep)", opacity: t === 0 ? 1 : 0.55 }} />
          <span style={{ width: AXIS - 6, fontSize: ts(11), lineHeight: "13px", fontVariantNumeric: "tabular-nums", transform: "translateY(-7px)" }}>{fmtNum(t)}</span>
        </div>
      ))}
      <div
        role="img"
        aria-label="Bar chart"
        onPointerDown={onDown}
        style={{ position: "absolute", left: 0, right: AXIS, top: 0, height, display: "flex", touchAction: "pan-y", cursor: "pointer" }}
      >
        {vals.map((v, i) => {
          const on = current < 0 || current === i;
          return (
            <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ position: "relative", height: plot, width: "62%", display: "flex", alignItems: "flex-end" }}>
                <span
                  style={{
                    width: "100%", height: `${(v / top) * 100}%`, borderRadius: cr(4), background: tint, opacity: on ? 1 : 0.35,
                    transformOrigin: "50% 100%", transform: `scaleY(${grown ? 1 : 0})`,
                    transition: `transform .75s ${BOUNCE} ${i * 45}ms, opacity .2s ease`,
                  }}
                />
                {current === i ? (
                  <span style={{ position: "absolute", left: "50%", bottom: `calc(${(v / top) * 100}% + 4px)`, transform: "translateX(-50%)", fontSize: ts(12), lineHeight: "16px", fontWeight: fw(700), color: "var(--ios-label)", whiteSpace: "nowrap" }}>
                    {fmtNum(v)}
                  </span>
                ) : null}
              </div>
              <span style={{ marginTop: 6, fontSize: ts(11), lineHeight: "13px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Option card

const Choice: Renderer = ({ node, p, box, fill }) => {
  const axis = useAxis();
  const rt = useRuntime();
  const [selected, select] = useChoice(s(p, "group").trim() || "plan", node.id, b(p, "selected"));
  const press = usePress(true, 0.97);
  const [pop, setPop] = useState(0);
  const ic = s(p, "icon");
  const badge = s(p, "badge").trim();
  const subtitle = s(p, "subtitle").trim();
  const trailing = s(p, "trailing").trim();
  return (
    <div
      {...box}
      {...press.on}
      role="radio"
      aria-checked={selected}
      onClick={(e) => {
        if (selected) return;
        select();
        setPop((k) => k + 1);
        rt.haptic("selection", e.currentTarget);
      }}
      style={{ ...box.style, ...press.style, ...fillStyle(fill, axis) }}
    >
      <Styles />
      <div
        key={pop}
        style={{
          display: "flex", alignItems: "center", gap: 12, padding: space(16), borderRadius: corner(16), background: "var(--ios-fill)", color: "var(--ios-label)",
          boxShadow: `inset 0 0 0 2px ${selected ? "var(--ios-accent)" : "transparent"}`, transition: "box-shadow .25s ease",
          animation: pop ? `spbn-pop .5s ${SPRING}` : undefined,
        }}
      >
        {ic !== "none" ? <span style={{ width: 32, flex: "none", display: "grid", placeItems: "center", color: "var(--ios-accent)" }}><Glyph name={ic} size={24} /></span> : null}
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ ...font("headline"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s(p, "title") || "Option"}</span>
            {badge ? <span style={{ fontSize: ts(11), lineHeight: "13px", fontWeight: fw(700), padding: "2px 6px", borderRadius: cr(999), background: "var(--ios-accent)", color: "var(--spb-accent-ink, #fff)", whiteSpace: "nowrap", flex: "none" }}>{badge}</span> : null}
          </span>
          {subtitle ? <span style={{ ...font("subheadline"), color: "var(--ios-label2)" }}>{subtitle}</span> : null}
        </span>
        {trailing ? <span style={{ ...font("subheadline", 600), whiteSpace: "nowrap" }}>{trailing}</span> : null}
        <span
          style={{
            width: 24, height: 24, borderRadius: cr("50%"), flex: "none", display: "grid", placeItems: "center", color: "#fff",
            background: selected ? "var(--ios-accent)" : "transparent", boxShadow: selected ? undefined : "inset 0 0 0 1.5px var(--ios-label3)",
            transition: "background-color .2s ease",
          }}
        >
          <span style={{ display: "grid", transform: `scale(${selected ? 1 : 0})`, transition: `transform .4s ${BOUNCE}` }}><Glyph name="checkmark" size={14} strokeWidth={3.2} /></span>
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Tag

const Tag: Renderer = ({ p, box, scheme }) => {
  const id = s(p, "tint");
  const c = paint(id, scheme);
  const style = s(p, "style");
  const ic = s(p, "icon");
  const colors: CSSProperties =
    style === "filled" ? { background: c, color: inkOn(id) }
    : style === "outlined" ? { color: c, boxShadow: `inset 0 0 0 1px ${c}` }
    : { color: c, background: `color-mix(in srgb, ${c} 15%, transparent)` };
  return (
    <span
      {...box}
      style={{ ...box.style, display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: cr(999), fontSize: ts(12), lineHeight: "16px", fontWeight: fw(600), whiteSpace: "nowrap", flex: "none", ...colors }}
    >
      {ic !== "none" ? <Glyph name={ic} size={12} strokeWidth={2.4} /> : null}
      {s(p, "text")}
    </span>
  );
};

export const nativeRenderers: Record<string, Renderer> = {
  image: ImageView, avatar: Avatar, "search-field": SearchField, slider: Slider, stepper: Stepper, progress: Progress, picker: Picker,
  menu: Menu, disclosure: Disclosure, "page-carousel": PageCarousel, chart: Chart, choice: Choice, tag: Tag,
};

