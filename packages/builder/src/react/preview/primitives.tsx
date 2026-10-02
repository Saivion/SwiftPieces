"use client";
// Web renderers for the native SwiftUI primitives. Each mirrors the emitter of the definition with
// the same id (definitions/primitives.ts): same props, same defaults, same layout rules. They behave
// like the SwiftUI too: buttons dip while pressed and follow their link, switches flip, fields take
// typing, segmented controls slide, and a screen collapses its large title and pulls to refresh.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { groundEntry } from "../../core/palette.js";
import { contourBackground, TONES } from "../../definitions/shared.js";
import { list } from "../../core/swift.js";
import { Glyph } from "../icons.js";
import { Frame, HEADING_STYLES, alignItems, b, fillStyle, font, n, paint, s, useAxis, useTheme, type Renderer, cr, ff, fw, ts } from "./env.js";
import { BOUNCE, SPRING, useDrag, useLive, useRuntime, useTap } from "./runtime.js";
import { glassSurface } from "./glass.js";

// ---------------------------------------------------------------- Shared interaction helpers
// Exported for the pieces chunk too (this file is always loaded).

/**
 * CSS the renderers need that inline styles can't express: placeholder color, keyframes. Injected
 * once, on the client, and switched off under Reduce Motion like the rest of the preview's motion.
 */
export function injectStyle(id: string, css: string) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

injectStyle(
  "spb-native-css",
  `.spb-in{flex:1;min-width:0;border:0;outline:0;padding:0;margin:0;background:transparent;font:inherit;color:var(--ios-label);caret-color:var(--ios-accent);-webkit-appearance:none;appearance:none}
.spb-in::placeholder{color:var(--ios-label3);opacity:1}
.spb-in:disabled{color:var(--ios-label3);-webkit-text-fill-color:var(--ios-label3)}
@keyframes spb-ios-spin{to{transform:rotate(360deg)}}
.spb-ios-spinner{animation:spb-ios-spin .9s steps(8) infinite}
@media (prefers-reduced-motion: reduce){.spb-ios-spinner{animation:none}}`,
);

/** Whether the viewer asked for less motion. Loops and repeating flourishes check it. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Press feedback: the control dips while a finger is down and springs back on release, like a
 * SwiftUI ButtonStyle reading `configuration.isPressed`. Spread `bind` on the element and merge
 * `style` into its style.
 */
export type PressBind = {
  onPointerDown?: (e: ReactPointerEvent) => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
  onPointerCancel?: () => void;
};

export function usePress(disabled = false, depth = 0.97, release = BOUNCE) {
  const [down, setDown] = useState(false);
  const pressed = down && !disabled;
  const bind: PressBind = disabled
    ? {}
    : {
        onPointerDown: (e: ReactPointerEvent) => {
          if (e.button === 0) setDown(true);
        },
        onPointerUp: () => setDown(false),
        onPointerLeave: () => setDown(false),
        onPointerCancel: () => setDown(false),
      };
  const style: CSSProperties = {
    transform: pressed ? `scale(${depth})` : undefined,
    transition: pressed ? "transform .12s cubic-bezier(.2, .8, .2, 1)" : `transform .5s ${release}`,
    cursor: disabled ? undefined : "pointer",
    touchAction: "manipulation",
    userSelect: "none",
    WebkitUserSelect: "none",
  };
  return { pressed, bind, style };
}

/** The iOS activity indicator: eight rounded ticks fading around, stepping as it spins. */
export function IOSSpinner({ size = 20, ticks = 8, color = "var(--ios-label2)", spinning = true, style }: { size?: number; ticks?: number; color?: string; spinning?: boolean; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={spinning ? "spb-ios-spinner" : undefined} style={{ display: "block", color, ...style }} aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="9" y="1.5" width="2" height="5" rx="1" fill="currentColor" transform={`rotate(${i * 45} 10 10)`} opacity={i < ticks ? 0.22 + (0.78 * (i + 1)) / 8 : 0} />
      ))}
    </svg>
  );
}

// The look's font design (set on the phone as --spb-font) wins over the system face.
const SF = 'var(--spb-font, -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Helvetica Neue", sans-serif)';

/** Stack spacing and padding, scaled by the look's density (set on the phone as --spb-space). */
const space = (px: number) => `calc(${px}px * var(--spb-space, 1))`;

const surface = (p: Record<string, unknown>): CSSProperties => {
  const style = p.style;
  if (style !== "card" && style !== "outlined") return {};
  const tone = style === "card" ? TONES[String(p.tone ?? "")] : undefined;
  const contour = style === "card" && p.texture === "contour";
  return {
    padding: `calc(${Number(p.padding ?? 0)}px * var(--spb-space, 1))`,
    borderRadius: `calc(${Number(p.radius ?? 0)}px * var(--spb-corner, 1))`,
    // A plain card takes Style's card treatment (flat, raised, outlined, glass or bold). Longhands
    // only: the contour texture below adds a backgroundImage, and React can't mix it with the
    // `background` shorthand when the texture is switched on or off.
    ...(style === "card" ? (tone ? { backgroundColor: tone.hex } : { backgroundColor: "var(--spb-card, var(--ios-fill))", boxShadow: "var(--spb-card-edge, none)", backdropFilter: "var(--spb-card-blur, none)", WebkitBackdropFilter: "var(--spb-card-blur, none)" }) : { boxShadow: "inset 0 0 0 1px var(--ios-fill4)" }),
    ...(contour ? { backgroundImage: contourBackground(), backgroundSize: "cover", backgroundPosition: "center" } : {}),
  };
};
/** A toned card reads as light mode inside (dark ink on the pastel), as the Swift sets it. */
const toneScheme = (p: Record<string, unknown>) => (p.style === "card" && TONES[String(p.tone ?? "")] ? "light" : undefined);

/**
 * How narrow a stack may get in a row: no narrower than what can't wrap inside it (a column of 44pt
 * buttons stays 44pt beside long text, as SwiftUI gives fixed views their size first); in a column,
 * as narrow as it's asked.
 */
const stackMin = (axis: "h" | "v") => (axis === "h" ? "min-content" : 0);

const VStack: Renderer = ({ p, children, box, fill }) => {
  const axis = useAxis();
  return (
    <div {...box} data-scheme={toneScheme(p)} className={`${box.className} spb-vflow`} style={{ display: "flex", flexDirection: "column", alignItems: alignItems(s(p, "alignment")), gap: space(n(p, "spacing")), minWidth: stackMin(axis), ...surface(p), ...fillStyle(fill, axis) }}>
      <Frame axis="v">{children}</Frame>
    </div>
  );
};

const HStack: Renderer = ({ p, children, box, fill }) => {
  const axis = useAxis();
  return (
    <div {...box} data-scheme={toneScheme(p)} style={{ display: "flex", flexDirection: "row", alignItems: alignItems(s(p, "alignment")), gap: space(n(p, "spacing")), minWidth: stackMin(axis), ...surface(p), ...fillStyle(fill, axis) }}>
      <Frame axis="h">{children}</Frame>
    </div>
  );
};

const Spacer: Renderer = ({ p, box }) => {
  const axis = useAxis();
  if (s(p, "mode") === "fixed") return <div {...box} style={{ height: n(p, "height"), flex: axis === "h" ? "1 1 0" : "none", minWidth: 8 }} />;
  return <div {...box} style={{ flex: "1 1 0", minHeight: 8, minWidth: 8 }} />;
};

const Divider: Renderer = ({ box }) => {
  const axis = useAxis();
  return <div {...box} style={axis === "v" ? { height: 1, alignSelf: "stretch", background: "var(--ios-sep)", flex: "none" } : { width: 1, alignSelf: "stretch", background: "var(--ios-sep)" }} />;
};

const designs: Record<string, string> = { default: SF, rounded: 'ui-rounded, "SF Pro Rounded", ' + SF, serif: 'ui-serif, "New York", Georgia, serif', monospaced: 'ui-monospace, "SF Mono", Menlo, monospace' };
const weightCss: Record<string, number | undefined> = { default: undefined, regular: 400, medium: 500, semibold: 600, bold: 700, heavy: 800, black: 900 };

const Text: Renderer = ({ p, box, scheme }) => {
  const lines = n(p, "lineLimit");
  return (
    <div
      {...box}
      style={{
        ...font(s(p, "style"), weightCss[s(p, "weight")]),
        // Titles (large title to title 3) take Style's heading font, as Theme.font does in the Swift.
        fontFamily: HEADING_STYLES.has(s(p, "style")) ? `var(--spb-heading-font, ${ff(designs[s(p, "design")] ?? SF)})` : ff(designs[s(p, "design")] ?? SF),
        color: paint(s(p, "color"), scheme),
        textAlign: s(p, "alignment") === "center" ? "center" : s(p, "alignment") === "trailing" ? "right" : "left",
        maxWidth: "100%",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        letterSpacing: n(p, "tracking") ? n(p, "tracking") : s(p, "style") === "largeTitle" || s(p, "style") === "title" ? "0.01em" : undefined,
        ...(lines > 0 ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}),
      }}
    >
      {s(p, "text") || " "}
    </div>
  );
};

const Symbol: Renderer = ({ p, box, scheme }) => {
  const size = n(p, "size");
  const color = paint(s(p, "color"), scheme);
  const badge = s(p, "badge");
  const glyph = <Glyph name={s(p, "icon")} size={Math.round(size * 1.05)} strokeWidth={size > 40 ? 1.5 : 1.8} />;
  if (badge === "none") return <div {...box} style={{ color }}>{glyph}</div>;
  const boxSize = Math.round(size * 1.9);
  return (
    <div {...box} style={{ color, width: boxSize, height: boxSize, display: "grid", placeItems: "center", borderRadius: cr(badge === "circle" ? "50%" : Math.round(boxSize * 0.28)), background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {glyph}
    </div>
  );
};

const buttonSizes: Record<string, { pad: string; font: number; radius: number; weight: number }> = {
  small: { pad: "5px 11px", font: 15, radius: 999, weight: 400 },
  regular: { pad: "7px 14px", font: 17, radius: 8, weight: 400 },
  large: { pad: "14px 20px", font: 17, radius: 12, weight: 600 },
};

const Button: Renderer = ({ p, box, fill, scheme }) => {
  const axis = useAxis();
  const theme = useTheme();
  const size = buttonSizes[s(p, "size")] ?? buttonSizes.large;
  const tint = paint(s(p, "tint"), scheme);
  const style = s(p, "style");
  const disabled = b(p, "disabled");
  const loading = b(p, "loading");
  const inert = disabled || loading;
  const shape = s(p, "shape");
  const plain = style === "plain";
  const press = usePress(inert);
  // A SwiftUI Button has no haptic of its own; it only follows its link.
  const tap = useTap(p.link, null);
  const radius = shape === "capsule" || (shape === "automatic" && theme?.corners === "soft") ? 999
    : shape === "rounded" ? n(p, "radius") * (theme?.cornerScale ?? 1)
    : shape === "automatic" && theme?.corners === "tight" ? Math.round(12 * theme.cornerScale) : size.radius;
  const ic = s(p, "icon");
  if (style === "glass") {
    // Liquid Glass (iOS 26): an icon on its own in a 44pt circle, text in a 44pt capsule, the label in the tint.
    const circle = !s(p, "title").trim() && ic !== "none" && !loading;
    return (
      <div
        {...box}
        {...press.bind}
        role="button"
        aria-label={circle ? ic : undefined}
        aria-disabled={inert || undefined}
        onClick={inert ? undefined : (e) => tap(e)}
        style={{
          ...box.style,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: "none",
          height: 44, ...(circle ? { width: 44 } : { padding: "0 16px" }), borderRadius: cr(999),
          fontSize: ts(15), lineHeight: "20px", fontWeight: fw(600), whiteSpace: "nowrap",
          color: disabled ? "var(--ios-label3)" : tint,
          ...glassSurface(scheme), ...fillStyle(fill, axis), ...press.style,
        }}
      >
        {loading ? <span className="spb-spinner" /> : circle ? <Glyph name={ic} size={17} strokeWidth={2.1} /> : (
          <>
            {ic !== "none" && s(p, "iconPosition") !== "trailing" ? <Glyph name={ic} size={16} strokeWidth={2.1} /> : null}
            <span>{s(p, "title")}</span>
            {ic !== "none" && s(p, "iconPosition") === "trailing" ? <Glyph name={ic} size={16} strokeWidth={2.1} /> : null}
          </>
        )}
      </div>
    );
  }
  const colors: CSSProperties = disabled
    ? plain ? { color: "var(--ios-label3)" } : { background: "var(--ios-fill)", color: "var(--ios-label3)" }
    : style === "filled" ? { background: tint, color: theme && s(p, "tint") === "accent" ? "var(--spb-accent-ink)" : s(p, "tint") === "white" || s(p, "tint") === "yellow" ? "#000" : "#fff" }
    : style === "tinted" ? { background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }
    : { color: tint };
  const label = loading ? <span className="spb-spinner" /> : (
    <>
      {ic !== "none" && s(p, "iconPosition") !== "trailing" ? <Glyph name={ic} size={size.font + 2} /> : null}
      <span>{s(p, "title")}</span>
      {ic !== "none" && s(p, "iconPosition") === "trailing" ? <Glyph name={ic} size={size.font + 2} /> : null}
    </>
  );
  return (
    <div
      {...box}
      {...press.bind}
      role="button"
      aria-disabled={inert || undefined}
      onClick={inert ? undefined : (e) => tap(e)}
      style={{
        ...box.style,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: plain ? 0 : size.pad, borderRadius: cr(radius), fontSize: ts(size.font), lineHeight: "22px",
        fontWeight: fw(plain ? 400 : size.weight), minHeight: plain ? undefined : s(p, "size") === "large" ? 50 : undefined,
        ...colors, ...fillStyle(fill, axis), ...press.style,
        // Borderless buttons highlight by fading, as iOS draws them.
        opacity: plain && press.pressed ? 0.45 : 1,
      }}
    >
      {label}
    </div>
  );
};

const appleLabels: Record<string, string> = { signIn: "Sign in with Apple", signUp: "Sign up with Apple", continue: "Continue with Apple" };
const AppleSignIn: Renderer = ({ p, box }) => {
  const axis = useAxis();
  const press = usePress();
  const style = s(p, "style");
  const dark = style === "black";
  return (
    <div
      {...box}
      {...press.bind}
      role="button"
      style={{
        ...box.style,
        height: n(p, "height"), borderRadius: cr(n(p, "radius")), display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: dark ? "#000" : "#fff", color: dark ? "#fff" : "#000", fontSize: ts(Math.round(n(p, "height") * 0.38)), fontWeight: fw(500),
        boxShadow: style === "whiteOutline" ? "inset 0 0 0 1px #000" : dark ? "inset 0 0 0 1px rgba(255,255,255,.14)" : undefined,
        ...fillStyle(true, axis), ...press.style,
      }}
    >
      <Glyph name="apple" size={Math.round(n(p, "height") * 0.4)} />
      {appleLabels[s(p, "label")]}
    </div>
  );
};

const Input: Renderer = ({ p, box }) => {
  const axis = useAxis();
  const label = s(p, "label").trim();
  const ic = s(p, "icon");
  const disabled = b(p, "disabled");
  const content = s(p, "content");
  const [value, setValue] = useState("");
  const field = (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: cr(n(p, "radius")), background: "var(--ios-fill)", color: "var(--ios-label3)", fontSize: ts(17), lineHeight: "22px", opacity: disabled ? 0.5 : 1, cursor: disabled ? undefined : "text" }}>
      {ic !== "none" ? <span style={{ color: "var(--ios-label2)", display: "flex" }}><Glyph name={ic} size={19} /></span> : null}
      <input
        className="spb-in"
        type={b(p, "secure") ? "password" : "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={s(p, "placeholder")}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize={content === "email" || content === "username" || content === "url" ? "none" : undefined}
        spellCheck={false}
        aria-label={label || s(p, "placeholder")}
        style={{ lineHeight: "22px", height: 22 }}
      />
    </label>
  );
  return (
    <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", gap: 6, ...fillStyle(true, axis) }}>
      {label ? <div style={{ ...font("subheadline"), color: "var(--ios-label2)" }}>{label}</div> : null}
      {field}
    </div>
  );
};

/**
 * The iOS switch. Interactive when given `onToggle`: the knob stretches while pressed and slides
 * across with a spring when it flips.
 */
export const Switch = ({ on, tint, onToggle, disabled }: { on: boolean; tint: string; onToggle?: (e: { currentTarget: Element }) => void; disabled?: boolean }) => {
  const press = usePress(!onToggle || disabled, 1);
  const wide = press.pressed;
  return (
    <span
      {...press.bind}
      role={onToggle ? "switch" : undefined}
      aria-checked={onToggle ? on : undefined}
      onClick={onToggle && !disabled ? (e) => { e.stopPropagation(); onToggle(e); } : undefined}
      style={{ width: 51, height: 31, borderRadius: cr(999), background: on ? tint : "var(--ios-fill2)", position: "relative", flex: "none", transition: "background .25s", cursor: onToggle ? "pointer" : undefined, touchAction: "manipulation" }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? (wide ? 16 : 22) : 2, width: wide ? 33 : 27, height: 27, borderRadius: cr(999), background: "#fff", boxShadow: "0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.16)", transition: `left .32s ${BOUNCE}, width .2s ${SPRING}` }} />
    </span>
  );
};

/** A toggle's local state: seeded from `isOn`, flipped by a tap with a light impact. */
function useToggle(isOn: boolean) {
  const { haptic } = useRuntime();
  const [on, setOn] = useLive(isOn);
  const flip = useCallback((e: { currentTarget: Element }) => {
    haptic("light", e.currentTarget);
    setOn((v) => !v);
  }, [haptic, setOn]);
  return [on, flip] as const;
}

const Toggle: Renderer = ({ p, box, scheme }) => {
  const axis = useAxis();
  const [on, flip] = useToggle(b(p, "isOn"));
  return (
    <div {...box} style={{ ...box.style, display: "flex", alignItems: "center", gap: 12, fontSize: ts(17), lineHeight: "22px", color: "var(--ios-label)", ...fillStyle(true, axis) }}>
      <span style={{ flex: 1 }}>{s(p, "label")}</span>
      <Switch on={on} tint={paint(s(p, "tint"), scheme)} onToggle={flip} />
    </div>
  );
};

const Segmented: Renderer = ({ p, box }) => {
  const axis = useAxis();
  const items = list(p.options, 5);
  const safe = items.length ? items : ["One", "Two"];
  const [picked, setPicked] = useLive(n(p, "selected"));
  const sel = Math.min(Math.max(0, picked), safe.length - 1);
  const count = safe.length;
  return (
    <div {...box} role="tablist" style={{ ...box.style, display: "flex", padding: 2, borderRadius: cr(9), background: "var(--ios-fill)", ...fillStyle(true, axis) }}>
      {/* The thumb slides between segments instead of blinking, as the system control does. */}
      <span aria-hidden style={{ position: "absolute", top: 2, bottom: 2, left: `calc(2px + (100% - 4px) * ${sel / count})`, width: `calc((100% - 4px) / ${count})`, borderRadius: cr(7), background: "var(--ios-seg)", boxShadow: "0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04)", transition: `left .34s ${SPRING}, width .34s ${SPRING}` }} />
      {safe.map((o, i) => (
        <span
          key={i}
          role="tab"
          aria-selected={i === sel}
          onClick={() => setPicked(i)}
          style={{ position: "relative", flex: 1, textAlign: "center", padding: "6px 4px", fontSize: ts(13), fontWeight: fw(i === sel ? 600 : 500), borderRadius: cr(7), color: "var(--ios-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", userSelect: "none", transition: "font-weight .2s" }}
        >
          {o}
        </span>
      ))}
    </div>
  );
};

const Row: Renderer = ({ p, box, scheme }) => {
  const axis = useAxis();
  const ic = s(p, "icon");
  const acc = s(p, "accessory");
  const toggles = acc === "toggle";
  const [on, flip] = useToggle(b(p, "isOn"));
  const linked = !toggles && s(p, "link") !== "";
  const press = usePress(!linked, 1);
  const tap = useTap(linked ? p.link : "", null);
  return (
    <div
      {...box}
      {...press.bind}
      role={linked ? "button" : undefined}
      onClick={linked ? (e) => tap(e) : undefined}
      style={{
        ...box.style,
        display: "flex", alignItems: "center", gap: 12, padding: "6px 0", fontSize: ts(17), lineHeight: "22px", color: "var(--ios-label)", ...fillStyle(true, axis),
        ...(linked ? press.style : {}),
        // The system row highlight: a fill that reaches past the row's edges without moving it.
        background: press.pressed ? "var(--ios-fill2)" : undefined,
        boxShadow: press.pressed ? "0 0 0 8px var(--ios-fill2)" : undefined,
        borderRadius: cr(4),
        transition: press.pressed ? "none" : "background .35s ease, box-shadow .35s ease",
      }}
    >
      {ic !== "none" ? (
        <span style={{ width: 30, height: 30, borderRadius: cr(7), display: "grid", placeItems: "center", background: paint(s(p, "iconColor"), scheme), color: "#fff", flex: "none" }}>
          <Glyph name={ic} size={18} strokeWidth={2} />
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s(p, "title")}</span>
      {toggles ? <Switch on={on} tint={paint("green", scheme)} onToggle={flip} /> : null}
      {!toggles && s(p, "value").trim() ? <span style={{ color: "var(--ios-label2)" }}>{s(p, "value")}</span> : null}
      {acc === "chevron" ? <span style={{ color: "var(--ios-label3)" }}><Glyph name="chevron.right" size={14} strokeWidth={2.6} /></span> : null}
    </div>
  );
};

/** The Card's action: a borderless button that fades while pressed and follows its link. */
function CardAction({ title, link, color }: { title: string; link: unknown; color: string }) {
  const press = usePress(false, 0.97);
  const tap = useTap(link, null);
  return (
    <div {...press.bind} role="button" onClick={(e) => tap(e)} style={{ fontSize: ts(17), color, paddingTop: 4, ...press.style, opacity: press.pressed ? 0.45 : 1 }}>
      {title}
    </div>
  );
}

/** The icon on a tinted square, as the tile and centred cards show it (Swift: a 44pt rounded rect at 15%). */
function CardChip({ icon, tint }: { icon: string; tint: string }) {
  return (
    <span style={{ width: 44, height: 44, flex: "none", borderRadius: cr(12), display: "grid", placeItems: "center", color: tint, background: `color-mix(in srgb, ${tint} 15%, transparent)` }}>
      <Glyph name={icon} size={20} strokeWidth={2.2} />
    </span>
  );
}

const Card: Renderer = ({ p, box, scheme }) => {
  const axis = useAxis();
  const tint = paint(s(p, "tint"), scheme);
  const layout = s(p, "layout");
  const hasIcon = s(p, "icon") !== "none" && s(p, "icon") !== "";
  const titleColor = paint(s(p, "titleColor") || "primary", scheme);
  const subtitle = s(p, "subtitle").trim() ? <div style={{ ...font("footnote"), color: "var(--ios-label2)" }}>{s(p, "subtitle")}</div> : null;
  const action = s(p, "action").trim() ? <CardAction title={s(p, "action")} link={p.link} color={tint} /> : null;
  if (layout === "tile") {
    return (
      <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", alignItems: "stretch", gap: 2, minHeight: `calc(104px + ${2 * Number(p.padding ?? 0)}px * var(--spb-space, 1))`, ...surface(p), ...fillStyle(true, axis) }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minHeight: 0 }}>
          {hasIcon ? <CardChip icon={s(p, "icon")} tint={tint} /> : null}
          <span style={{ flex: 1 }} />
          {s(p, "value").trim() ? <span style={{ ...font("title2"), fontWeight: fw(700), fontVariantNumeric: "tabular-nums", color: "var(--ios-label)" }}>{s(p, "value")}</span> : null}
        </div>
        <span style={{ flex: "1 0 20px" }} />
        {s(p, "title").trim() ? <div style={{ ...font("subheadline"), fontWeight: fw(500), color: titleColor, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s(p, "title")}</div> : null}
        {subtitle}
        {action}
      </div>
    );
  }
  if (layout === "center") {
    return (
      <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10, ...surface(p), ...fillStyle(true, axis) }}>
        {hasIcon ? <CardChip icon={s(p, "icon")} tint={tint} /> : null}
        {s(p, "title").trim() ? <div style={{ ...font("footnote"), fontWeight: fw(600), color: titleColor }}>{s(p, "title")}</div> : null}
        {subtitle}
        {action}
      </div>
    );
  }
  return (
    <div {...box} style={{ ...box.style, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, ...surface(p), ...fillStyle(true, axis) }}>
      {hasIcon ? <span style={{ color: tint }}><Glyph name={s(p, "icon")} size={26} /></span> : null}
      {s(p, "title").trim() ? <div style={{ ...font("headline"), color: titleColor }}>{s(p, "title")}</div> : null}
      {s(p, "subtitle").trim() ? <div style={{ ...font("subheadline"), color: "var(--ios-label2)" }}>{s(p, "subtitle")}</div> : null}
      {action}
    </div>
  );
};

// ---------------------------------------------------------------- Screen

/** Where the navigation bar sits: y 54–98 on a phone screen, 22–66 inside a sheet. */
function useNavFrame(ref: RefObject<HTMLElement | null>) {
  const [frame, setFrame] = useState({ top: 54, pushed: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = { top: el.closest(".is-in-sheet") ? 22 : 54, pushed: Boolean(el.closest(".is-pushed")) };
    setFrame((f) => (f.top === next.top && f.pushed === next.pushed ? f : next));
  }, [ref]);
  return frame;
}

const PULL_COMMIT = 64;
const PULL_REST = 54;

/**
 * Pull to refresh, as `.refreshable` behaves: at the top of the scroll view a pull stretches the
 * content down and winds up the spinner; past the threshold it holds, spins, then settles.
 */
function useRefresh(enabled: boolean, scrollRef: RefObject<HTMLDivElement | null>, contentRef: RefObject<HTMLDivElement | null>, spinnerRef: RefObject<HTMLDivElement | null>) {
  const { haptic } = useRuntime();
  const [spinning, setSpinning] = useState(false);
  const [ticks, setTicks] = useState(0);
  const state = useRef({ armed: false, pull: 0, busy: false });
  const draw = useCallback((pull: number, animate: boolean) => {
    state.current.pull = pull;
    const t = animate ? `transform .45s ${SPRING}, opacity .3s` : "none";
    if (contentRef.current) {
      contentRef.current.style.transition = t;
      contentRef.current.style.transform = pull ? `translateY(${pull}px)` : "";
    }
    if (spinnerRef.current) {
      spinnerRef.current.style.transition = t;
      spinnerRef.current.style.opacity = String(Math.min(1, pull / 30));
      spinnerRef.current.style.transform = `translateY(${Math.max(0, pull / 2 - 14)}px)`;
    }
    setTicks(Math.max(0, Math.min(8, Math.round((pull / PULL_COMMIT) * 8))));
  }, [contentRef, spinnerRef]);
  const release = useCallback((el: Element | null) => {
    if (state.current.pull >= PULL_COMMIT) {
      state.current.busy = true;
      setSpinning(true);
      draw(PULL_REST, true);
      window.setTimeout(() => {
        haptic("light", el);
        setSpinning(false);
        draw(0, true);
        state.current.busy = false;
      }, 1000);
    } else draw(0, true);
  }, [haptic, draw]);
  const drag = useDrag({
    axis: "y",
    slop: 6,
    onStart: ({ dy }) => {
      state.current.armed = enabled && !state.current.busy && dy > 0 && (scrollRef.current?.scrollTop ?? 1) <= 0;
    },
    onMove: ({ dy }) => {
      if (!state.current.armed) return;
      // Rubber band: the further you pull, the less it follows.
      draw(Math.max(0, Math.min(150, dy * 0.55 - (dy * dy) / 2400)), false);
    },
    onEnd: ({ el }) => {
      if (!state.current.armed) return;
      state.current.armed = false;
      release(el);
    },
  });
  // Trackpads: an upward wheel at the top pulls, and a pause in the wheel counts as letting go.
  useEffect(() => {
    const el = scrollRef.current;
    if (!enabled || !el) return;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      if (state.current.busy || el.scrollTop > 0 || (e.deltaY >= 0 && state.current.pull === 0)) return;
      draw(Math.max(0, Math.min(150, state.current.pull - e.deltaY * 0.35)), false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => release(el), 160);
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(timer);
    };
  }, [enabled, scrollRef, paint, release]);
  const onPointerDown = enabled
    ? (e: ReactPointerEvent<HTMLElement>) => {
        // Text fields keep their own drags (selecting text).
        if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
        drag(e);
      }
    : undefined;
  return { onPointerDown, spinning, ticks };
}

/** The trailing toolbar button: an SF Symbol in the accent that follows its link. */
function ToolbarButton({ icon, link, top }: { icon: string; link: unknown; top: number }) {
  const tap = useTap(link, null);
  const press = usePress(false, 0.9);
  return (
    <div
      {...press.bind}
      role="button"
      aria-label={icon}
      onClick={(e) => tap(e)}
      style={{ position: "absolute", zIndex: 3, top, right: 8, height: 44, minWidth: 44, padding: "0 8px", display: "grid", placeItems: "center", color: "var(--ios-accent)", ...press.style, opacity: press.pressed ? 0.45 : 1 }}
    >
      <Glyph name={icon} size={22} strokeWidth={2} />
    </div>
  );
}

/** The screen root: grounds, the navigation bar, scrolling and the outer stack. */
const Screen: Renderer = ({ node, p, children, box, scheme }) => {
  const bg = groundEntry(s(p, "background"));
  const scrolls = b(p, "scrolls");
  // A hidden navigation bar takes its title and toolbar button with it (the screen draws its own).
  const ownBar = s(p, "navigationBar") === "hidden";
  const title = ownBar ? "" : s(p, "title").trim();
  const tool = ownBar ? "none" : s(p, "toolbarIcon");
  const hasTool = Boolean(tool) && tool !== "none";
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const nav = useNavFrame(rootRef);
  const [collapsed, setCollapsed] = useState(false);
  const refresh = useRefresh(scrolls && b(p, "refreshable"), scrollRef, contentRef, spinnerRef);

  // The large title scrolls away and a small centered title settles into the bar in its place.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !title || !scrolls) {
      setCollapsed(false);
      return;
    }
    // A screen in a hidden tab measures 0 tall; it hasn't scrolled, so it stays expanded until shown.
    const check = () => {
      const h = titleRef.current?.offsetHeight ?? 0;
      setCollapsed(h > 0 && el.scrollTop > h - 12);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(check);
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro?.disconnect();
    };
  }, [title, scrolls]);

  // The stack takes the screen's height when something in it grows into the rest: a flexible spacer,
  // an outcome screen, or a component set to fill the screen (a breathing session's scene).
  const grow = (node.children ?? []).some((c) => (c.component === "spacer" && c.props.mode !== "fixed") || c.component === "outcome-screen" || c.props.fillsScreen === true);
  const stack: CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: alignItems(s(p, "alignment")), gap: space(n(p, "spacing")), padding: space(n(p, "padding")),
    ...(scrolls ? {} : { flex: grow ? "1 1 auto" : "0 1 auto", margin: s(p, "position") === "top" ? "0 0 auto" : "auto 0", minHeight: 0 }),
  };
  const ground = bg.swift ? bg[scheme] : "var(--spb-theme-bg, var(--ios-bg))";
  const barHeight = nav.top + 44;
  const content = (
    <>
      {title ? <div ref={titleRef} className="spb-navtitle">{title}</div> : null}
      <div className="spb-vflow" style={stack}>
        <Frame axis="v">{children}</Frame>
      </div>
    </>
  );
  return (
    <div
      {...box}
      ref={rootRef}
      // A toolbar button needs the bar's 44pt; a pushed screen already leaves it for the back button.
      style={{ ...box.style, background: ground, ...(hasTool && !nav.pushed ? { paddingTop: barHeight } : {}) }}
    >
      {title && scrolls ? (
        <div
          aria-hidden={!collapsed}
          style={{
            position: "absolute", zIndex: 2, top: 0, left: 0, right: 0, height: barHeight, pointerEvents: "none",
            background: `color-mix(in srgb, ${ground} 78%, transparent)`, backdropFilter: "saturate(1.8) blur(20px)", WebkitBackdropFilter: "saturate(1.8) blur(20px)",
            boxShadow: "inset 0 -0.5px 0 var(--ios-sep)", opacity: collapsed ? 1 : 0, transition: "opacity .22s ease",
          }}
        >
          <div style={{ position: "absolute", top: nav.top, left: 96, right: 96, height: 44, display: "grid", placeItems: "center", fontSize: ts(17), fontWeight: fw(600), color: "var(--ios-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transform: collapsed ? "none" : "translateY(6px)", transition: `transform .3s ${SPRING}` }}>
            <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          </div>
        </div>
      ) : null}
      {hasTool ? <ToolbarButton icon={tool} link={p.toolbarLink} top={nav.top} /> : null}
      {scrolls ? (
        <div ref={scrollRef} className="spb-screen-scroll" style={{ position: "relative" }} onPointerDown={refresh.onPointerDown}>
          {b(p, "refreshable") ? (
            <div ref={spinnerRef} aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: 0, pointerEvents: "none" }}>
              <IOSSpinner size={28} ticks={refresh.spinning ? 8 : refresh.ticks} spinning={refresh.spinning} />
            </div>
          ) : null}
          <div ref={contentRef}>{content}</div>
        </div>
      ) : (
        <div className="spb-screen-fixed">{content}</div>
      )}
    </div>
  );
};

export const primitiveRenderers: Record<string, Renderer> = {
  screen: Screen, vstack: VStack, hstack: HStack, spacer: Spacer, divider: Divider, text: Text, symbol: Symbol,
  button: Button, "apple-sign-in": AppleSignIn, input: Input, toggle: Toggle, segmented: Segmented, row: Row, card: Card,
};
