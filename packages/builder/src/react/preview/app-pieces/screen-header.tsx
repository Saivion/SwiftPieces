"use client";
// Screen Header in the preview: eyebrow, the two-weight title, and round icon buttons that follow
// their links with a light haptic and a springy dip, as the Swift's HeaderIconButtonStyle does.
import { useState } from "react";
import { Glyph } from "../../icons.js";
import { n, s, type Renderer, type Scheme, cr, fw, ts, useTheme } from "../env.js";
import { glassSurface } from "../glass.js";
import { BOUNCE, useTap } from "../runtime.js";
import { LABEL, LABEL2, WideRoot } from "./data-kit.js";

function IconButton({ icon, link, glass }: { icon: string; link: unknown; glass?: Scheme | null }) {
  const tap = useTap(link, "light");
  const [down, setDown] = useState(false);
  return (
    <span
      role="button"
      aria-label={icon}
      onClick={(e) => tap(e)}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        width: 44, height: 44, flex: "none", borderRadius: cr(22), display: "grid", placeItems: "center", cursor: "pointer", color: LABEL,
        ...(glass ? glassSurface(glass) : { background: "var(--ios-fill3, rgba(118,118,128,.24))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }),
        transform: `scale(${down ? (glass ? 0.94 : 0.88) : 1})`, transition: `transform .3s ${BOUNCE}`,
      }}
    >
      <Glyph name={icon} size={glass ? 17 : 19} strokeWidth={glass ? 2.1 : 2.2} />
    </span>
  );
}

/** The text button: a capsule with its words (and icon), glass or a soft fill, as the Swift draws it. */
function TextButton({ text, icon, link, glass }: { text: string; icon: string; link: unknown; glass?: Scheme | null }) {
  const tap = useTap(link, "light");
  const [down, setDown] = useState(false);
  return (
    <span
      role="button"
      onClick={(e) => tap(e)}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        height: 44, flex: "none", padding: "0 16px", borderRadius: cr(22), display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: LABEL,
        fontSize: ts(15), fontWeight: fw(600), whiteSpace: "nowrap",
        ...(glass ? glassSurface(glass) : { background: "var(--ios-fill3, rgba(118,118,128,.24))" }),
        transform: `scale(${down ? 0.94 : 1})`, transition: `transform .3s ${BOUNCE}`,
      }}
    >
      {icon && icon !== "none" ? <Glyph name={icon} size={15} strokeWidth={2.4} /> : null}
      {text}
    </span>
  );
}

function Avatar({ initials, link }: { initials: string; link: unknown }) {
  const tap = useTap(link, link ? "light" : null);
  return (
    <span
      role={link ? "button" : undefined}
      onClick={link ? (e) => tap(e) : undefined}
      style={{ width: 44, height: 44, flex: "none", borderRadius: cr(22), display: "grid", placeItems: "center", background: "var(--ios-fill2, rgba(120,120,128,.32))", color: LABEL, fontSize: ts(15), fontWeight: fw(600), cursor: link ? "pointer" : undefined }}
    >
      {initials}
    </span>
  );
}

export const ScreenHeader: Renderer = (r) => {
  // Style → Headers: bold sets the whole title in one bold weight; centered centres it.
  const headers = useTheme()?.headers ?? "split";
  if (headers === "bold") r = { ...r, p: { ...r.p, emphasisStyle: "bold", leadWeight: "bold" } };
  const centered = headers === "centered";
  const size = n(r.p, "size") || 32;
  const lead = s(r.p, "title").trim();
  const emph = s(r.p, "emphasis").trim();
  const style = s(r.p, "emphasisStyle") || "bold";
  const stacked = s(r.p, "stacked") !== "no";
  const trailing = s(r.p, "trailing");
  const eyebrow = s(r.p, "eyebrow").trim();
  const subtitle = s(r.p, "subtitle").trim();
  const words = s(r.p, "buttonText").trim() || "Create";
  // Liquid Glass buttons (the Buttons option), as the Swift's GlassButtonStyle draws them.
  const glass = s(r.p, "buttons") === "glass" ? r.scheme : null;
  const emphStyle =
    style === "accent" ? { fontWeight: fw(700), color: "var(--spb-accent, var(--ios-accent))" }
    : style === "muted" ? { fontWeight: fw(400), color: LABEL2 }
    : { fontWeight: fw(700) };
  return (
    <WideRoot r={r} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "relative" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6, ...(centered ? { alignItems: "center", textAlign: "center", padding: trailing !== "none" ? "0 52px" : undefined } : {}) }}>
        {eyebrow ? <span style={{ fontSize: ts(15), lineHeight: "20px", fontWeight: fw(500), color: LABEL2 }}>{eyebrow}</span> : null}
        <span style={{ fontFamily: "var(--spb-heading-font, inherit)", fontSize: ts(size), lineHeight: 1.12, letterSpacing: -0.4, fontWeight: fw(emph ? 400 : style === "muted" ? 400 : 700), color: LABEL }}>
          {emph && s(r.p, "leadWeight") === "bold" ? <span style={{ fontWeight: fw(700) }}>{lead}</span> : lead}
          {emph ? (
            <>
              {stacked ? <br /> : " "}
              <span style={emphStyle}>{emph}</span>
            </>
          ) : null}
        </span>
        {centered && subtitle ? <span style={{ fontSize: ts(15), lineHeight: "20px", color: LABEL2 }}>{subtitle}</span> : null}
      </div>
      {centered && trailing !== "none" ? (
        <span style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 10 }}>
          {trailing === "icon" ? <IconButton icon={s(r.p, "icon") || "plus"} link={r.p.link} glass={glass} /> : null}
          {trailing === "two" ? (
            <>
              <IconButton icon={s(r.p, "icon") || "plus"} link={r.p.link} glass={glass} />
              <IconButton icon={s(r.p, "icon2") || "ellipsis"} link={r.p.link2} glass={glass} />
            </>
          ) : null}
          {trailing === "avatar" ? <Avatar initials={s(r.p, "initials").trim().slice(0, 3) || "AK"} link={r.p.link} /> : null}
          {trailing === "text" ? <TextButton text={words} icon={s(r.p, "icon")} link={r.p.link} glass={glass} /> : null}
        </span>
      ) : null}
      {!centered && trailing === "icon" ? <IconButton icon={s(r.p, "icon") || "plus"} link={r.p.link} glass={glass} /> : null}
      {!centered && trailing === "two" ? (
        <span style={{ display: "flex", gap: 10 }}>
          <IconButton icon={s(r.p, "icon") || "plus"} link={r.p.link} glass={glass} />
          <IconButton icon={s(r.p, "icon2") || "ellipsis"} link={r.p.link2} glass={glass} />
        </span>
      ) : null}
      {!centered && trailing === "text" ? <TextButton text={words} icon={s(r.p, "icon")} link={r.p.link} glass={glass} /> : null}
      {!centered && trailing === "avatar" ? (
        <Avatar initials={s(r.p, "initials").trim().slice(0, 3) || "AK"} link={r.p.link} />
      ) : null}
    </div>
      {/* The subtitle runs under the whole row, the width of the screen, as the Swift lays it out. */}
      {!centered && subtitle ? <span style={{ fontSize: ts(15), lineHeight: "20px", color: LABEL2 }}>{subtitle}</span> : null}
    </WideRoot>
  );
};
