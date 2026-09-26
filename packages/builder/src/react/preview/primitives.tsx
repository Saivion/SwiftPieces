"use client";
// Web renderers for the native SwiftUI primitives. Each mirrors the emitter of the definition with
// the same id (definitions/primitives.ts): same props, same defaults, same layout rules.
import type { CSSProperties } from "react";
import { groundEntry } from "../../core/palette.js";
import { list } from "../../core/swift.js";
import { Glyph } from "../icons.js";
import { Frame, alignItems, b, fillStyle, font, n, paint, s, useAxis, type Renderer } from "./env.js";

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Helvetica Neue", sans-serif';

const surface = (p: Record<string, unknown>): CSSProperties => {
  const style = p.style;
  if (style !== "card" && style !== "outlined") return {};
  return {
    padding: Number(p.padding ?? 0),
    borderRadius: Number(p.radius ?? 0),
    ...(style === "card" ? { background: "var(--ios-fill)" } : { boxShadow: "inset 0 0 0 1px var(--ios-fill4)" }),
  };
};

const VStack: Renderer = ({ p, children, box, fill }) => {
  const axis = useAxis();
  return (
    <div {...box} style={{ display: "flex", flexDirection: "column", alignItems: alignItems(s(p, "alignment")), gap: n(p, "spacing"), minWidth: 0, ...surface(p), ...fillStyle(fill, axis) }}>
      <Frame axis="v">{children}</Frame>
    </div>
  );
};

const HStack: Renderer = ({ p, children, box, fill }) => {
  const axis = useAxis();
  return (
    <div {...box} style={{ display: "flex", flexDirection: "row", alignItems: alignItems(s(p, "alignment")), gap: n(p, "spacing"), minWidth: 0, ...surface(p), ...fillStyle(fill, axis) }}>
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
        fontFamily: designs[s(p, "design")] ?? SF,
        color: paint(s(p, "color"), scheme),
        textAlign: s(p, "alignment") === "center" ? "center" : s(p, "alignment") === "trailing" ? "right" : "left",
        maxWidth: "100%",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        letterSpacing: s(p, "style") === "largeTitle" || s(p, "style") === "title" ? "0.01em" : undefined,
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
    <div {...box} style={{ color, width: boxSize, height: boxSize, display: "grid", placeItems: "center", borderRadius: badge === "circle" ? "50%" : Math.round(boxSize * 0.28), background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
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
  const size = buttonSizes[s(p, "size")] ?? buttonSizes.large;
  const tint = paint(s(p, "tint"), scheme);
  const style = s(p, "style");
  const disabled = b(p, "disabled");
  const radius = s(p, "shape") === "capsule" ? 999 : s(p, "shape") === "rounded" ? n(p, "radius") : size.radius;
  const ic = s(p, "icon");
  const plain = style === "plain";
  const colors: CSSProperties = disabled
    ? plain ? { color: "var(--ios-label3)" } : { background: "var(--ios-fill)", color: "var(--ios-label3)" }
    : style === "filled" ? { background: tint, color: s(p, "tint") === "white" || s(p, "tint") === "yellow" ? "#000" : "#fff" }
    : style === "tinted" ? { background: `color-mix(in srgb, ${tint} 18%, transparent)`, color: tint }
    : { color: tint };
  const label = b(p, "loading") ? <span className="spb-spinner" /> : (
    <>
      {ic !== "none" && s(p, "iconPosition") !== "trailing" ? <Glyph name={ic} size={size.font + 2} /> : null}
      <span>{s(p, "title")}</span>
      {ic !== "none" && s(p, "iconPosition") === "trailing" ? <Glyph name={ic} size={size.font + 2} /> : null}
    </>
  );
  return (
    <div
      {...box}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: plain ? 0 : size.pad, borderRadius: radius, fontSize: size.font, lineHeight: "22px",
        fontWeight: plain ? 400 : size.weight, minHeight: plain ? undefined : s(p, "size") === "large" ? 50 : undefined,
        ...colors, ...fillStyle(fill, axis),
      }}
    >
      {label}
    </div>
  );
};

const appleLabels: Record<string, string> = { signIn: "Sign in with Apple", signUp: "Sign up with Apple", continue: "Continue with Apple" };
const AppleSignIn: Renderer = ({ p, box }) => {
  const axis = useAxis();
  const style = s(p, "style");
  const dark = style === "black";
  return (
    <div
      {...box}
      style={{
        height: n(p, "height"), borderRadius: n(p, "radius"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: dark ? "#000" : "#fff", color: dark ? "#fff" : "#000", fontSize: Math.round(n(p, "height") * 0.38), fontWeight: 500,
        boxShadow: style === "whiteOutline" ? "inset 0 0 0 1px #000" : dark ? "inset 0 0 0 1px rgba(255,255,255,.14)" : undefined,
        ...fillStyle(true, axis),
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
  const field = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderRadius: n(p, "radius"), background: "var(--ios-fill)", color: "var(--ios-label3)", fontSize: 17, lineHeight: "22px", opacity: b(p, "disabled") ? 0.5 : 1 }}>
      {ic !== "none" ? <span style={{ color: "var(--ios-label2)" }}><Glyph name={ic} size={19} /></span> : null}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s(p, "placeholder") || " "}</span>
    </div>
  );
  return (
    <div {...box} style={{ display: "flex", flexDirection: "column", gap: 6, ...fillStyle(true, axis) }}>
      {label ? <div style={{ ...font("subheadline"), color: "var(--ios-label2)" }}>{label}</div> : null}
      {field}
    </div>
  );
};

export const Switch = ({ on, tint }: { on: boolean; tint: string }) => (
  <span style={{ width: 51, height: 31, borderRadius: 999, background: on ? tint : "var(--ios-fill2)", position: "relative", flex: "none", transition: "background .2s" }}>
    <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: "50%", background: "#fff", boxShadow: "0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.16)", transition: "left .2s" }} />
  </span>
);

const Toggle: Renderer = ({ p, box, scheme }) => {
  const axis = useAxis();
  return (
    <div {...box} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 17, lineHeight: "22px", color: "var(--ios-label)", ...fillStyle(true, axis) }}>
      <span style={{ flex: 1 }}>{s(p, "label")}</span>
      <Switch on={b(p, "isOn")} tint={paint(s(p, "tint"), scheme)} />
    </div>
  );
};

const Segmented: Renderer = ({ p, box }) => {
  const axis = useAxis();
  const items = list(p.options, 5);
  const safe = items.length ? items : ["One", "Two"];
  const sel = Math.min(Math.max(0, n(p, "selected")), safe.length - 1);
  return (
    <div {...box} style={{ display: "flex", padding: 2, borderRadius: 9, background: "var(--ios-fill)", ...fillStyle(true, axis) }}>
      {safe.map((o, i) => (
        <span key={i} style={{ flex: 1, textAlign: "center", padding: "6px 4px", fontSize: 13, fontWeight: i === sel ? 600 : 500, borderRadius: 7, color: "var(--ios-label)", background: i === sel ? "var(--ios-seg)" : undefined, boxShadow: i === sel ? "0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04)" : undefined, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
  return (
    <div {...box} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", fontSize: 17, lineHeight: "22px", color: "var(--ios-label)", ...fillStyle(true, axis) }}>
      {ic !== "none" ? (
        <span style={{ width: 30, height: 30, borderRadius: 7, display: "grid", placeItems: "center", background: paint(s(p, "iconColor"), scheme), color: "#fff", flex: "none" }}>
          <Glyph name={ic} size={18} strokeWidth={2} />
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s(p, "title")}</span>
      {acc === "toggle" ? <Switch on={b(p, "isOn")} tint={paint("green", scheme)} /> : null}
      {acc !== "toggle" && s(p, "value").trim() ? <span style={{ color: "var(--ios-label2)" }}>{s(p, "value")}</span> : null}
      {acc === "chevron" ? <span style={{ color: "var(--ios-label3)" }}><Glyph name="chevron.right" size={14} strokeWidth={2.6} /></span> : null}
    </div>
  );
};

const Card: Renderer = ({ p, box, scheme }) => {
  const axis = useAxis();
  const tint = paint(s(p, "tint"), scheme);
  return (
    <div {...box} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, ...surface(p), ...fillStyle(true, axis) }}>
      {s(p, "icon") !== "none" ? <span style={{ color: tint }}><Glyph name={s(p, "icon")} size={26} /></span> : null}
      {s(p, "title").trim() ? <div style={{ ...font("headline"), color: "var(--ios-label)" }}>{s(p, "title")}</div> : null}
      {s(p, "subtitle").trim() ? <div style={{ ...font("subheadline"), color: "var(--ios-label2)" }}>{s(p, "subtitle")}</div> : null}
      {s(p, "action").trim() ? <div style={{ fontSize: 17, color: tint, paddingTop: 4 }}>{s(p, "action")}</div> : null}
    </div>
  );
};

/** The screen root: grounds, the navigation title, scrolling and the outer stack. */
const Screen: Renderer = ({ node, p, children, box, scheme }) => {
  const bg = groundEntry(s(p, "background"));
  const scrolls = b(p, "scrolls");
  const title = s(p, "title").trim();
  const grow = (node.children ?? []).some((c) => c.component === "spacer" && c.props.mode !== "fixed") || (node.children ?? []).some((c) => c.component === "outcome-screen");
  const stack: CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: alignItems(s(p, "alignment")), gap: n(p, "spacing"), padding: n(p, "padding"),
    ...(scrolls ? {} : { flex: grow ? "1 1 auto" : "0 1 auto", margin: s(p, "position") === "top" ? "0 0 auto" : "auto 0", minHeight: 0 }),
  };
  return (
    <div {...box} style={{ ...box.style, background: bg.swift ? bg[scheme] : "var(--ios-bg)" }}>
      <div className={scrolls ? "spb-screen-scroll" : "spb-screen-fixed"}>
        {title ? <div className="spb-navtitle">{title}</div> : null}
        <div style={stack}>
          <Frame axis="v">{children}</Frame>
        </div>
      </div>
    </div>
  );
};

export const primitiveRenderers: Record<string, Renderer> = {
  screen: Screen, vstack: VStack, hstack: HStack, spacer: Spacer, divider: Divider, text: Text, symbol: Symbol,
  button: Button, "apple-sign-in": AppleSignIn, input: Input, toggle: Toggle, segmented: Segmented, row: Row, card: Card,
};
