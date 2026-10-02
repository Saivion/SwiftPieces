"use client";
// Glass Bar in the preview: Liquid Glass controls on each side and the title centred over the whole
// width (kept clear of the wider side), as the Swift's ZStack lays it out. Each control follows its
// link with a light haptic and dips like iOS 26's interactive glass.
import { useState, type ReactNode } from "react";
import { titleInset } from "../../../definitions/app-pieces/glass-bar.js";
import { Glyph } from "../../icons.js";
import { s, type Renderer, type Scheme, cr, fw, ts } from "../env.js";
import { glassSurface } from "../glass.js";
import { BOUNCE, useTap } from "../runtime.js";
import { LABEL, WideRoot } from "./data-kit.js";

function GlassControl({ link, scheme, circle, accent, label, children }: { link: unknown; scheme: Scheme; circle: boolean; accent?: boolean; label: string; children: ReactNode }) {
  const tap = useTap(link, "light");
  const [down, setDown] = useState(false);
  return (
    <span
      role="button"
      aria-label={label}
      onClick={(e) => tap(e)}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        height: 44, ...(circle ? { width: 44 } : { padding: "0 16px" }), flex: "none", borderRadius: cr(999), display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        cursor: "pointer", whiteSpace: "nowrap", fontSize: ts(15), fontWeight: fw(600), color: accent ? "var(--ios-accent)" : LABEL,
        ...glassSurface(scheme), transform: `scale(${down ? 0.94 : 1})`, transition: `transform .3s ${BOUNCE}`,
      }}
    >
      {children}
    </span>
  );
}

function Avatar({ initials, link }: { initials: string; link: unknown }) {
  const tap = useTap(link, link ? "light" : null);
  return (
    <span
      role={link ? "button" : undefined}
      onClick={link ? (e) => tap(e) : undefined}
      style={{ width: 36, height: 36, flex: "none", borderRadius: cr(18), display: "grid", placeItems: "center", background: "var(--ios-fill2, rgba(120,120,128,.32))", color: LABEL, fontSize: ts(15), fontWeight: fw(600), cursor: link ? "pointer" : undefined }}
    >
      {initials}
    </span>
  );
}

function Control({ kind, icon, text, link, initials, scheme }: { kind: string; icon: string; text: string; link: unknown; initials: string; scheme: Scheme }) {
  switch (kind) {
    case "back":
      return <GlassControl link={link} scheme={scheme} circle label="Back"><Glyph name="chevron.left" size={17} strokeWidth={2.2} /></GlassControl>;
    case "close":
      return <GlassControl link={link} scheme={scheme} circle label="Close"><Glyph name="xmark" size={16} strokeWidth={2.2} /></GlassControl>;
    case "icon":
      return <GlassControl link={link} scheme={scheme} circle label={icon}><Glyph name={icon} size={17} strokeWidth={2.1} /></GlassControl>;
    case "text":
      return <GlassControl link={link} scheme={scheme} circle={false} label={text}>{text}</GlassControl>;
    case "menu":
      return (
        <GlassControl link={link} scheme={scheme} circle={false} label={text}>
          {text}
          <Glyph name="chevron.down" size={12} strokeWidth={2.6} />
        </GlassControl>
      );
    case "done":
      return <GlassControl link={link} scheme={scheme} circle={false} accent label={text || "Done"}>{text || "Done"}</GlassControl>;
    case "avatar":
      return <Avatar initials={initials.trim().slice(0, 3) || "AK"} link={link} />;
    default:
      return null;
  }
}

export const GlassBar: Renderer = (r) => {
  const { p, scheme } = r;
  const trailing = s(p, "trailing");
  const title = s(p, "title").trim();
  const inset = titleInset(p);
  return (
    <WideRoot r={r} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
      {title ? (
        <span
          style={{
            position: "absolute", left: inset, right: inset, top: "50%", transform: "translateY(-50%)", textAlign: "center", pointerEvents: "none",
            fontSize: ts(17), lineHeight: "22px", fontWeight: fw(600), color: LABEL, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
      ) : null}
      <Control kind={s(p, "leading")} icon={s(p, "leadingIcon")} text={s(p, "leadingText")} link={p.leadingLink} initials={s(p, "initials")} scheme={scheme} />
      <span style={{ flex: 1, minWidth: 8 }} />
      {trailing === "two" ? (
        <>
          <Control kind="icon" icon={s(p, "trailingIcon")} text="" link={p.trailingLink} initials="" scheme={scheme} />
          <Control kind="icon" icon={s(p, "trailingIcon2")} text="" link={p.trailingLink2} initials="" scheme={scheme} />
        </>
      ) : (
        <Control kind={trailing} icon={s(p, "trailingIcon")} text={s(p, "trailingText")} link={p.trailingLink} initials={s(p, "initials")} scheme={scheme} />
      )}
    </WideRoot>
  );
};
