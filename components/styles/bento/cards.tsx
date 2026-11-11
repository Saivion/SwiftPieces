"use client";
// The bento canvas's cards: small moments of an app, each built like a SwiftPieces component and
// wearing the style (its accent and palette, its fonts and weight, its corners, cards and buttons,
// its springs). Every card is a pure function of the shared clock (motion.ts), on its own cycle,
// so the whole grid is alive at once without any card waiting on another. Sizes are design pixels
// on a 1000 x 780 canvas, scaled to the canvas by `--k` (u()).
import { memo, type CSSProperties, type ReactNode } from "react";
import { clamp01, cycle, expo, io, mix, soft, stepper, useSpring, useTime, type Ease } from "./motion";

/** A design size, scaled to the canvas. */
export const u = (n: number) => `calc(var(--k) * ${n})`;

const ink = "var(--bc-ink)";
const muted = "var(--bc-muted)";
const faint = "var(--bc-faint)";
const cardBg = "var(--bc-card)";
const accent = "var(--spb-accent)";
const accentInk = "var(--spb-accent-ink)";
const c = (i: number) => `var(--bc-c${i})`;
/** An inner card's corner, a pill, and a small corner, all following the style's Corners. */
const r = (n: number) => `calc(var(--k) * ${n} * var(--spb-corner, 1))`;
const pill = (h: number) => `min(var(--spb-pill, 999px), calc(var(--k) * ${h / 2}))`;
const heading: CSSProperties = { fontFamily: "var(--spb-heading-font, var(--spb-font, inherit))" };
const w = (n: number) => `min(900, max(100, calc(${n} + var(--spb-weight, 0))))`;
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/** An inner card: the canvas's card colour with the style's card edge (raised, outlined, glass, bold). */
const inner = (extra: CSSProperties = {}): CSSProperties => ({
  background: cardBg,
  borderRadius: r(14),
  boxShadow: "var(--bc-edge, none)",
  backdropFilter: "var(--spb-card-blur, none)",
  ...extra,
});

/** The card's frame: padding and a column, design-sized. */
function Pad({ children, p = 14, gap = 0, style }: { children: ReactNode; p?: number; gap?: number; style?: CSSProperties }) {
  return <div style={{ position: "absolute", inset: 0, padding: u(p), display: "flex", flexDirection: "column", gap: u(gap), ...style }}>{children}</div>;
}

function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontSize: u(11.5), color: muted, fontWeight: w(500), lineHeight: 1.2, ...style }}>{children}</span>;
}

function Title({ children, size = 14, style }: { children: ReactNode; size?: number; style?: CSSProperties }) {
  return <span style={{ ...heading, fontSize: `calc(${u(size)} * var(--spb-title-k, 1))`, color: ink, fontWeight: w(600), lineHeight: 1.15, letterSpacing: "-0.01em", ...style }}>{children}</span>;
}

/* ------------------------------------------------------------------------------------------------
 * Rolling figures: each digit a column of 0-9 that rolls up to its next value, left to right.
 * ---------------------------------------------------------------------------------------------- */

const DIGITS = "01234567890123456789".split("");

/** `from` rolling to `to`, `l` seconds into the change. Digits roll; anything else crossfades. */
export function Roll({ from, to, l, dur = 0.7, stagger = 0.05, spring }: { from: string; to: string; l: number; dur?: number; stagger?: number; spring: Ease }) {
  const n = Math.max(from.length, to.length);
  const a = from.padStart(n, " ");
  const b = to.padStart(n, " ");
  let digitIndex = 0;
  return (
    <span style={{ display: "inline-flex", fontVariantNumeric: "tabular-nums", whiteSpace: "pre" }}>
      {b.split("").map((ch, i) => {
        const was = a[i];
        const p = clamp01((l - digitIndex * stagger) / dur);
        if (/\d/.test(ch) || /\d/.test(was)) digitIndex += 1;
        if (/\d/.test(ch) && /\d/.test(was)) {
          const x = Number(was);
          const d = (Number(ch) - x + 10) % 10;
          const pos = x + d * spring(p);
          return (
            <span key={i} style={{ position: "relative", display: "inline-block", overflow: "hidden", height: "1.15em", lineHeight: "1.15em", maskImage: p > 0 && p < 1 ? "linear-gradient(transparent, #000 22%, #000 78%, transparent)" : undefined }}>
              <span style={{ visibility: "hidden" }}>0</span>
              <span style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${-pos * 1.15}em)` }}>
                {DIGITS.map((g, j) => (
                  <span key={j} style={{ display: "block", height: "1.15em" }}>
                    {g}
                  </span>
                ))}
              </span>
            </span>
          );
        }
        if (was === ch) return <span key={i}>{ch === " " ? "" : ch}</span>;
        const q = soft(p);
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", height: "1.15em", lineHeight: "1.15em" }}>
            <span style={{ opacity: q, display: "inline-block", transform: `translateY(${(1 - q) * 0.4}em)` }}>{ch === " " ? "" : ch}</span>
            {was !== " " ? <span style={{ position: "absolute", left: 0, top: 0, opacity: 1 - q }}>{was}</span> : null}
          </span>
        );
      })}
    </span>
  );
}

/** A value stepping through `values` every `period` seconds, rolling as it changes. */
function Stepped({ t, values, period, offset, spring, dur = 0.7 }: { t: number; values: readonly string[]; period: number; offset: number; spring: Ease; dur?: number }) {
  const { k, l } = cycle(t, period, offset);
  if (k < 0) return <Roll from={values[0]} to={values[0]} l={1} spring={spring} />;
  return <Roll from={values[k % values.length]} to={values[(k + 1) % values.length]} l={l} dur={dur} spring={spring} />;
}

/* ------------------------------------------------------------------------------------------------
 * Small line icons, in the card's ink.
 * ---------------------------------------------------------------------------------------------- */

function Icon({ d, size = 14, fill = false, stroke = 1.8, style }: { d: string; size?: number; fill?: boolean; stroke?: number; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={u(size)} height={u(size)} style={{ width: u(size), height: u(size), flex: "none", display: "block", ...style }} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const ICON = {
  play: "M8 5.5v13l11-6.5z",
  pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  prev: "M6 6v12M18 6l-9 6 9 6z",
  next: "M18 6v12M6 6l9 6-9 6z",
  heart: "M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2z",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  sun: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  speaker: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  lock: "M6.5 11h11v9h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
};

/* ------------------------------------------------------------------------------------------------
 * The cards.
 * ---------------------------------------------------------------------------------------------- */

const TRACKS = [
  { title: "Low Tide", artist: "Mara Vale", a: 0, b: 1 },
  { title: "Paper Moons", artist: "The Quiet Hours", a: 2, b: 3 },
  { title: "Night Swim", artist: "Juno Park", a: 1, b: 4 },
];

/** Now Playing: the art crossfades between tracks, the time runs, the bars dance. */
export const Player = memo(function Player() {
  const t = useTime();
  const spring = useSpring();
  const P = 8;
  const { k, l } = cycle(t, P, 1.4);
  const idx = ((k % 3) + 3) % 3;
  const prev = TRACKS[idx];
  const cur = TRACKS[(idx + 1) % 3];
  const q = k < 0 ? 1 : soft(l / 0.9);
  const shown = k < 0 ? TRACKS[0] : cur;
  const length = 204;
  const at = 38 + (k < 0 ? t : l) * 6.5;
  const pct = clamp01(at / length);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const art = (tr: (typeof TRACKS)[number]) => `radial-gradient(120% 90% at 20% 15%, ${c(tr.a)} 0%, transparent 60%), radial-gradient(100% 100% at 85% 90%, ${c(tr.b)} 0%, transparent 65%), ${accent}`;
  const press = k >= 0 && l < 0.5 ? 1 - 0.08 * Math.sin(Math.PI * clamp01(l / 0.5)) : 1;
  return (
    <Pad p={12} gap={10}>
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, borderRadius: r(12), overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: art(k < 0 ? TRACKS[0] : prev) }} />
        <div style={{ position: "absolute", inset: 0, background: art(shown), opacity: q }} />
        <div style={{ position: "absolute", right: "-18%", bottom: "-30%", width: "70%", aspectRatio: "1", borderRadius: "50%", border: `${u(10)} solid rgb(255 255 255 / .16)`, transform: `rotate(${t * 40}deg)` }} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: u(8) }}>
        <div style={{ position: "relative", minWidth: 0, flex: 1, height: u(34) }}>
          {[k < 0 ? null : prev, shown].map((tr, i) =>
            tr ? (
              <div key={i} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", opacity: i ? q : 1 - q, transform: `translateY(${i ? (1 - q) * 6 : -q * 6}px)` }}>
                <Title size={14.5} style={{ whiteSpace: "nowrap" }}>{tr.title}</Title>
                <Label style={{ whiteSpace: "nowrap" }}>{tr.artist}</Label>
              </div>
            ) : null,
          )}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: u(2.5), height: u(14), paddingBottom: u(4) }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ width: u(3), borderRadius: u(2), background: accent, height: `${30 + 70 * (0.5 + 0.5 * Math.sin(t * (5.2 + i * 1.3) + i * 1.7))}%` }} />
          ))}
        </div>
      </div>
      <div>
        <div style={{ position: "relative", height: u(4), borderRadius: u(2), background: faint }}>
          <div style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, borderRadius: u(2), background: ink }} />
          <div style={{ position: "absolute", top: "50%", left: `${pct * 100}%`, width: u(10), height: u(10), marginLeft: u(-5), marginTop: u(-5), borderRadius: "50%", background: ink }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: u(5), fontSize: u(10), color: muted, fontVariantNumeric: "tabular-nums" }}>
          <span>{fmt(at)}</span>
          <span>{fmt(length)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: u(22), color: ink }}>
        <Icon d={ICON.prev} size={15} fill={false} />
        <span style={{ display: "grid", placeItems: "center", width: u(38), height: u(38), borderRadius: "50%", background: ink, color: "var(--bc-card-solid)", transform: `scale(${press * spring(1)})` }}>
          <Icon d={ICON.pause} size={15} fill />
        </span>
        <Icon d={ICON.next} size={15} />
      </div>
    </Pad>
  );
});

const SEGMENTS = ["All", "Saved", "Shared"];

/** Glass Segments: the glider springs from one choice to the next. */
export const Segments = memo(function Segments() {
  const t = useTime();
  const spring = useSpring();
  const order = [0, 1, 2, 1];
  const { from, to, p } = stepper(t, 2.6, 0.9, order, 0.75);
  const x = mix(from, to, spring(p));
  const stretch = 1 + 0.12 * Math.sin(Math.PI * clamp01(p * 1.4));
  return (
    <Pad p={10} style={{ justifyContent: "center" }}>
      <div style={{ position: "relative", display: "flex", height: u(38), padding: u(3), borderRadius: pill(38), background: faint }}>
        <div style={{ position: "absolute", top: u(3), bottom: u(3), left: `calc(${u(3)} + (100% - ${u(6)}) / 3 * ${x})`, width: `calc((100% - ${u(6)}) / 3)`, borderRadius: pill(32), ...inner({ borderRadius: pill(32) }), boxShadow: "0 1px 2px rgb(0 0 0 / .08), var(--bc-edge, 0 0 0 0 transparent)", transform: `scaleX(${stretch})` }} />
        {SEGMENTS.map((s, i) => {
          const on = 1 - Math.min(1, Math.abs(x - i));
          return (
            <span key={s} style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", fontSize: u(12.5), fontWeight: w(on > 0.5 ? 600 : 500), color: `color-mix(in srgb, ${ink} ${Math.round(50 + 50 * on)}%, transparent)` }}>
              {s}
            </span>
          );
        })}
      </div>
    </Pad>
  );
});

const CODES = ["482915", "730264", "195837"];

/** Secure Entry: the code arrives a digit at a time, the field it's in outlined, then it's checked. */
export const Code = memo(function Code() {
  const t = useTime();
  const spring = useSpring();
  const P = 7.2;
  const { k, l } = cycle(t, P, 0.6);
  const code = CODES[((k % 3) + 3) % 3];
  const at = (i: number) => 0.3 + i * 0.32;
  const done = k < 0 ? 0 : soft((l - at(6) - 0.2) / 0.5);
  const out = k < 0 ? 0 : soft((l - (P - 0.7)) / 0.6);
  return (
    <Pad p={14} gap={4}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: u(3) }}>
          <Title>Verification code</Title>
          <Label>Sent to •••• 21</Label>
        </div>
        <span style={{ position: "relative", width: u(20), height: u(20) }}>
          <svg viewBox="0 0 20 20" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 - done, transform: `rotate(${t * 360}deg)` }}>
            <circle cx="10" cy="10" r="7.5" fill="none" stroke={accent} strokeWidth="2.2" strokeDasharray="32 47" strokeLinecap="round" />
          </svg>
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", borderRadius: "50%", background: accent, color: accentInk, opacity: done, transform: `scale(${spring(done)})` }}>
            <Icon d={ICON.check} size={12} stroke={2.6} />
          </span>
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: u(5) }}>
        {code.split("").map((d, i) => {
          const p = k < 0 ? 0 : clamp01((l - at(i)) / 0.5);
          const shown = p > 0 ? 1 - out : 0;
          const active = k >= 0 && l >= at(i) - 0.32 && l < at(i) + 0.05 ? 1 : 0;
          return (
            <span key={i} style={{ ...inner({ borderRadius: r(10) }), height: u(44), display: "grid", placeItems: "center", fontSize: u(20), fontWeight: w(600), color: ink, fontVariantNumeric: "tabular-nums", boxShadow: active ? `inset 0 0 0 ${u(1.8)} ${accent}` : done > 0 ? `inset 0 0 0 ${u(1.5)} ${tint("var(--spb-accent)", Math.round(55 * done * (1 - out)))}` : "var(--bc-edge, none)" }}>
              <span style={{ opacity: shown, transform: `translateY(${(1 - spring(p)) * 8}px) scale(${0.7 + 0.3 * spring(p)})` }}>{d}</span>
            </span>
          );
        })}
      </div>
    </Pad>
  );
});

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Date Strip: the selected day springs across the week. */
export const Week = memo(function Week() {
  const t = useTime();
  const spring = useSpring();
  const { from, to, p } = stepper(t, 2.3, 1.1, [3, 4, 1, 5, 2, 6], 0.8);
  const x = mix(from, to, spring(p));
  const squash = 1 - 0.1 * Math.sin(Math.PI * clamp01(p * 1.3));
  return (
    <Pad p={14}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Title size={15}>November</Title>
        <Label>Week 46</Label>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        <div style={{ position: "absolute", top: u(-6), bottom: u(-6), width: `calc(100% / 7)`, left: `calc(100% / 7 * ${x})`, display: "grid", placeItems: "center" }}>
          <span style={{ width: "88%", height: "100%", borderRadius: pill(56), background: accent, transform: `scaleY(${squash})`, boxShadow: `0 ${u(6)} ${u(14)} ${u(-6)} ${tint("var(--spb-accent)", 70)}` }} />
        </div>
        {DAYS.map((d, i) => {
          const on = 1 - Math.min(1, Math.abs(x - i));
          const color = `color-mix(in srgb, ${accentInk} ${Math.round(on * 100)}%, ${ink})`;
          return (
            <span key={i} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: u(6), color }}>
              <span style={{ fontSize: u(10), opacity: 0.6 + 0.4 * on }}>{d}</span>
              <span style={{ fontSize: u(15), fontWeight: w(600), fontVariantNumeric: "tabular-nums" }}>{9 + i}</span>
            </span>
          );
        })}
      </div>
      <div style={{ height: u(6) }} />
    </Pad>
  );
});

const GLYPHS = ["Aa", "Gg", "Rr", "Qq"];

/** Type: the style's heading font, large, with its body font named under it. */
export const TypeCard = memo(function TypeCard({ headingName, bodyName }: { headingName: string; bodyName: string }) {
  const t = useTime();
  const spring = useSpring();
  const { from, to, p } = stepper(t, 3.1, 1.6, GLYPHS, 0.8);
  const q = soft(p);
  return (
    <Pad p={14}>
      <Label>Type</Label>
      <div style={{ position: "relative", flex: 1, ...heading, color: ink, fontWeight: w(700), fontSize: u(64), lineHeight: 1, letterSpacing: "-0.04em" }}>
        {[from, to].map((g, i) => (
          <span key={i} style={{ position: "absolute", left: 0, bottom: u(4), opacity: i ? q : 1 - q, transform: i ? `translateY(${(1 - spring(p)) * 14}px)` : `translateY(${-q * 10}px)`, filter: `blur(${(i ? 1 - q : q) * 3}px)` }}>
            {g}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: u(2), borderTop: `1px solid ${faint}`, paddingTop: u(8) }}>
        <span style={{ ...heading, fontSize: u(12.5), fontWeight: w(600), color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{headingName}</span>
        <span style={{ fontSize: u(11), color: muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bodyName === headingName ? "Headings and body" : `Body: ${bodyName}`}</span>
      </div>
    </Pad>
  );
});

/** Activity Heatmap: a month's days light up in turn, the streak rolls on. */
export const Heat = memo(function Heat() {
  const t = useTime();
  const spring = useSpring();
  const P = 8;
  const { k, l } = cycle(t, P, 0.4);
  const out = k < 0 ? 0 : soft((l - (P - 0.8)) / 0.7);
  const level = (i: number) => [0.25, 0.6, 1, 0.45, 0.8, 0.3, 1, 0.65, 0.9, 0.2, 0.55, 1, 0.75, 0.4][(i * 7 + 3) % 14];
  const streak = 20 + Math.max(0, k + 1);
  return (
    <Pad p={14}>
      <Label>Design streak</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: u(5), marginTop: u(4) }}>
        <Title size={26} style={{ fontWeight: w(700) }}>
          <Roll from={String(streak - (k < 0 ? 0 : 1))} to={String(streak)} l={k < 0 ? 1 : l - 4.6} spring={spring} />
        </Title>
        <Label>days</Label>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: u(4) }}>
        {Array.from({ length: 21 }, (_, i) => {
          const p = k < 0 ? 0 : clamp01((l - 0.2 - i * 0.2) / 0.45);
          const v = spring(p) * level(i) * (1 - out);
          return (
            <span key={i} style={{ aspectRatio: "1", borderRadius: r(4), background: faint, position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "inherit", background: accent, opacity: v, transform: `scale(${0.4 + 0.6 * Math.min(1, spring(p))})` }} />
            </span>
          );
        })}
      </div>
    </Pad>
  );
});

/** Liquid Switch: dark mode on, dark mode off, the card turning with it. */
export const Toggle = memo(function Toggle() {
  const t = useTime();
  const spring = useSpring();
  const { from, to, p } = stepper(t, 3.4, 1.2, [0, 1], 0.8);
  const x = mix(from, to, spring(p));
  const shade = mix(from, to, soft(p));
  const stretch = 1 + 0.38 * Math.sin(Math.PI * clamp01(p * 1.6));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "var(--bc-inverse)", opacity: shade }} />
      <Pad p={14} style={{ alignItems: "center", justifyContent: "center", gap: u(12) }}>
        <span style={{ position: "relative", width: u(22), height: u(22), color: `color-mix(in srgb, var(--bc-inverse-ink) ${Math.round(shade * 100)}%, ${ink})` }}>
          <Icon d={ICON.sun} size={22} style={{ position: "absolute", opacity: 1 - shade, transform: `rotate(${shade * 90}deg) scale(${1 - shade * 0.4})` }} />
          <Icon d={ICON.moon} size={22} style={{ position: "absolute", opacity: shade, transform: `rotate(${(shade - 1) * 60}deg) scale(${0.6 + shade * 0.4})` }} />
        </span>
        <span style={{ ...heading, fontSize: u(14), fontWeight: w(600), color: `color-mix(in srgb, var(--bc-inverse-ink) ${Math.round(shade * 100)}%, ${ink})` }}>Dark mode</span>
        <span style={{ position: "relative", width: u(60), height: u(34), borderRadius: pill(34), background: `color-mix(in srgb, ${accent} ${Math.round(x * 100)}%, var(--bc-switch-off))` }}>
          <span style={{ position: "absolute", top: u(3), left: `calc(${u(3)} + ${u(26)} * ${x})`, width: u(28), height: u(28), borderRadius: pill(28), background: "#fff", boxShadow: "0 1px 3px rgb(0 0 0 / .2)", transform: `scaleX(${stretch})`, transformOrigin: to > from ? "left" : "right" }} />
        </span>
      </Pad>
    </div>
  );
});

/** Reaction Toggle: a like that pops, bursts and counts. */
export const React_ = memo(function Reaction() {
  const t = useTime();
  const spring = useSpring();
  const P = 3.2;
  const { k, l } = cycle(t, P, 1.5);
  const p = k < 0 ? 1 : clamp01(l / 0.7);
  const pop = k < 0 ? 1 : 0.62 + 0.38 * spring(p);
  const burst = k < 0 ? 1 : expo(l / 0.7);
  const count = 1284 + Math.max(0, k + 1);
  return (
    <Pad p={14} style={{ alignItems: "center", justifyContent: "center", gap: u(10) }}>
      <span style={{ position: "relative", width: u(56), height: u(56) }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${u(2)} solid ${accent}`, opacity: (1 - burst) * 0.8, transform: `scale(${1 + burst * 0.7})` }} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const d = 22 + burst * 18;
          return <span key={i} style={{ position: "absolute", left: "50%", top: "50%", width: u(5), height: u(5), marginLeft: u(-2.5), marginTop: u(-2.5), borderRadius: "50%", background: c((i % 4) + 1), opacity: k < 0 ? 0 : 1 - burst, transform: `translate(calc(var(--k) * ${Math.cos(a) * d}), calc(var(--k) * ${Math.sin(a) * d}))` }} />;
        })}
        <span style={{ ...inner({ borderRadius: "50%" }), position: "absolute", inset: 0, display: "grid", placeItems: "center", color: accent, boxShadow: "0 1px 2px rgb(0 0 0 / .06), var(--bc-edge, 0 0 0 0 transparent)" }}>
          <Icon d={ICON.heart} size={24} fill style={{ transform: `scale(${pop})` }} />
        </span>
      </span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: u(1) }}>
        <Title size={18} style={{ fontWeight: w(700) }}>
          <Roll from={(count - (k < 0 ? 0 : 1)).toLocaleString("en-US")} to={count.toLocaleString("en-US")} l={k < 0 ? 1 : l} spring={spring} />
        </Title>
        <Label>likes</Label>
      </div>
    </Pad>
  );
});

const BALANCES = ["$12,480.32", "$12,516.08", "$12,497.64", "$12,563.10"];
const CHANGES = ["+2.4%", "+2.7%", "+2.5%", "+3.1%"];

/** Odometer and Scrub Chart: the balance rolls, the curve drifts, the scrubber glides along it. */
export const Balance = memo(function Balance() {
  const t = useTime();
  const spring = useSpring();
  const curve = (x: number) => 0.2 + 0.65 * raw(x);
  const raw = (x: number) => 0.52 + 0.17 * Math.sin(x * 5.1 + t * 0.35) + 0.09 * Math.sin(x * 11.3 - t * 0.6) + 0.05 * Math.sin(x * 23 + t * 0.9) - x * 0.18;
  const N = 48;
  const pts = Array.from({ length: N + 1 }, (_, i) => [i / N, curve(i / N)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${(x * 100).toFixed(2)},${(y * 60).toFixed(2)}`).join(" ");
  const sx = 0.12 + 0.76 * io(0.5 + 0.5 * Math.sin(t * 0.55));
  const sy = curve(sx);
  return (
    <Pad p={16}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Label>Balance</Label>
        <span style={{ fontSize: u(11), fontWeight: w(600), color: accent, background: tint("var(--spb-accent)", 12), padding: `${u(3)} ${u(8)}`, borderRadius: pill(20) }}>
          <Stepped t={t} values={CHANGES} period={3.2} offset={1.2} spring={spring} />
        </span>
      </div>
      <Title size={30} style={{ marginTop: u(6), fontWeight: w(700), letterSpacing: "-0.02em" }}>
        <Stepped t={t} values={BALANCES} period={3.2} offset={1.2} spring={spring} dur={0.8} />
      </Title>
      <div style={{ position: "relative", flex: 1, marginTop: u(10), marginInline: u(-16), marginBottom: u(-16) }}>
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            <linearGradient id="bc-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--spb-accent)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--spb-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L100,60 L0,60 Z`} fill="url(#bc-area)" />
          <path d={line} fill="none" stroke="var(--spb-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${sx * 100}%`, width: 1, background: faint }} />
        <div style={{ position: "absolute", left: `${sx * 100}%`, top: `${(sy * 100).toFixed(2)}%`, width: u(12), height: u(12), marginLeft: u(-6), marginTop: u(-6), borderRadius: "50%", background: cardBg, boxShadow: `0 0 0 ${u(2.5)} ${accent}, 0 0 0 ${u(8)} ${tint("var(--spb-accent)", 14)}` }} />
      </div>
    </Pad>
  );
});

const CHATS = [
  { ask: "Can it feel warmer?", reply: "Done. Coral accent, softer corners, and a little more room." },
  { ask: "Ship it tonight?", reply: "Builds are green. I'll queue it for 9 pm and post the notes." },
];

/** Streaming Reply: a question slides in, the answer types, then makes way for the next. */
export const Chat = memo(function Chat() {
  const t = useTime();
  const spring = useSpring();
  const P = 7.5;
  const { k, l } = cycle(t, P, 0.2);
  const chat = CHATS[((k % 2) + 2) % 2];
  const ask = k < 0 ? 0 : clamp01(l / 0.6);
  const dots = k < 0 ? 0 : clamp01((l - 0.7) / 0.2) * (1 - clamp01((l - 1.6) / 0.15));
  const words = chat.reply.split(" ");
  const shown = k < 0 ? 0 : Math.max(0, (l - 1.7) / 0.13);
  const replyIn = k < 0 ? 0 : soft((l - 1.6) / 0.4);
  const out = k < 0 ? 0 : soft((l - (P - 0.6)) / 0.55);
  return (
    <Pad p={14} gap={8}>
      <div style={{ display: "flex", alignItems: "center", gap: u(8) }}>
        <span style={{ width: u(24), height: u(24), borderRadius: "50%", background: `linear-gradient(135deg, ${c(2)}, ${c(3)})` }} />
        <div style={{ display: "flex", flexDirection: "column", gap: u(1) }}>
          <Title size={12.5}>Ari</Title>
          <span style={{ fontSize: u(10), color: accent }}>online</span>
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: u(6), opacity: 1 - out, transform: `translateY(${-out * 12}px)` }}>
        <span style={{ alignSelf: "flex-end", maxWidth: "80%", padding: `${u(7)} ${u(11)}`, borderRadius: r(16), borderBottomRightRadius: r(5), background: accent, color: accentInk, fontSize: u(12), opacity: ask, transform: `translateY(${(1 - spring(ask)) * 14}px) scale(${0.9 + 0.1 * spring(ask)})`, transformOrigin: "right bottom" }}>
          {chat.ask}
        </span>
        <div style={{ position: "relative", alignSelf: "flex-start", maxWidth: "88%" }}>
          <span style={{ position: "absolute", left: 0, bottom: 0, display: "flex", gap: u(3), padding: `${u(10)} ${u(12)}`, ...inner({ borderRadius: r(16) }), opacity: dots }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: u(5), height: u(5), borderRadius: "50%", background: muted, transform: `translateY(${Math.sin(t * 9 - i * 0.9) * 2}px)` }} />
            ))}
          </span>
          <span style={{ display: "block", padding: `${u(7)} ${u(11)}`, ...inner({ borderRadius: r(16) }), borderBottomLeftRadius: r(5), fontSize: u(12), lineHeight: 1.35, color: ink, opacity: replyIn, transform: `translateY(${(1 - replyIn) * 6}px)` }}>
            {words.map((wd, i) => (
              <span key={i} style={{ opacity: clamp01(shown - i), transition: "none" }}>
                {wd}{" "}
              </span>
            ))}
          </span>
        </div>
      </div>
    </Pad>
  );
});

const TASKS = ["Pick a type scale", "Wire the paywall", "Record the walkthrough", "Ship the build"];

/** Task Row: the day's tasks tick off one by one, then the list starts fresh. */
export const Tasks = memo(function Tasks() {
  const t = useTime();
  const spring = useSpring();
  const P = 8.4;
  const { k, l } = cycle(t, P, 0.3);
  const at = [0.7, 1.9, 3.1, 4.3];
  const reset = k < 0 ? 0 : soft((l - (P - 1)) / 0.8);
  const done = at.filter((a) => k >= 0 && l > a + 0.2).length;
  const doneNow = reset > 0.5 ? 0 : done;
  return (
    <Pad p={14} gap={8}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Title size={15}>Today</Title>
        <Label style={{ display: "inline-flex", gap: u(3) }}>
          <Roll from={String(Math.max(0, doneNow - 1))} to={String(doneNow)} l={9} spring={spring} />
          of 4 done
        </Label>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: u(6) }}>
        {TASKS.map((task, i) => {
          const p = k < 0 ? 0 : clamp01((l - at[i]) / 0.55) * (1 - reset);
          const s = spring(p);
          return (
            <div key={task} style={{ ...inner({ borderRadius: r(12) }), display: "flex", alignItems: "center", gap: u(10), height: u(40), padding: `0 ${u(12)}` }}>
              <span style={{ position: "relative", width: u(20), height: u(20), flex: "none" }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: r(6), boxShadow: `inset 0 0 0 ${u(1.5)} ${tint("var(--bc-ink)", 25)}` }} />
                <span style={{ position: "absolute", inset: 0, borderRadius: r(6), background: accent, transform: `scale(${s})`, opacity: Math.min(1, p * 3) }} />
                <svg viewBox="0 0 20 20" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                  <path d="M5.5 10.4l3 3 6-6.6" fill="none" stroke="var(--spb-accent-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - clamp01((p - 0.25) / 0.6)} />
                </svg>
              </span>
              <span style={{ position: "relative", fontSize: u(12.5), color: `color-mix(in srgb, ${ink} ${Math.round(100 - 50 * soft(p))}%, transparent)`, whiteSpace: "nowrap" }}>
                {task}
                <span style={{ position: "absolute", left: 0, top: "52%", height: u(1.4), width: `${soft((p - 0.3) / 0.7) * 100}%`, background: muted }} />
              </span>
            </div>
          );
        })}
      </div>
    </Pad>
  );
});

const RING_SETS = [
  [0.86, 0.64, 0.42],
  [0.52, 0.9, 0.7],
  [1, 0.46, 0.84],
];

/** Ring Breakdown: three rings sweep to the day's numbers, the total rolls with them. */
export const Rings = memo(function Rings() {
  const t = useTime();
  const spring = useSpring();
  const { from, to, p } = stepper(t, 3.6, 0.8, RING_SETS, 1.1);
  const vals = to.map((v, i) => mix(from[i], v, spring(p)));
  const pct = (s: number[]) => String(Math.round((s[0] * 100)));
  const colors = [accent, c(2), c(3)];
  return (
    <Pad p={12} style={{ alignItems: "center", justifyContent: "center", gap: u(8) }}>
      <svg viewBox="0 0 100 100" style={{ width: u(104), height: u(104), transform: "rotate(-90deg)" }}>
        {[40, 29, 18].map((rad, i) => {
          const len = 2 * Math.PI * rad;
          return (
            <g key={i}>
              <circle cx="50" cy="50" r={rad} fill="none" stroke={colors[i]} strokeOpacity=".18" strokeWidth="9" />
              <circle cx="50" cy="50" r={rad} fill="none" stroke={colors[i]} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * Math.min(vals[i], 0.999)} ${len}`} />
            </g>
          );
        })}
      </svg>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: u(4), fontSize: u(11.5), color: muted }}>
        Move
        <span style={{ color: ink, fontWeight: w(600), display: "inline-flex" }}>
          <Roll from={pct(from)} to={pct(to)} l={p * 1.1} spring={spring} />%
        </span>
      </span>
    </Pad>
  );
});

/** Expanding Track: volume and brightness glide, each track swelling while it moves. */
export const Sliders = memo(function Sliders() {
  const t = useTime();
  const spring = useSpring();
  const tracks = [
    { icon: ICON.speaker, s: stepper(t, 2.8, 0.9, [0.62, 0.28, 0.84, 0.46], 0.8) },
    { icon: ICON.sun, s: stepper(t, 3.3, 2.2, [0.4, 0.78, 0.55, 0.9], 0.8) },
  ];
  return (
    <Pad p={14} style={{ flexDirection: "row", justifyContent: "center", gap: u(12) }}>
      {tracks.map(({ icon, s }, i) => {
        const v = mix(s.from, s.to, spring(s.p));
        const moving = Math.sin(Math.PI * clamp01(s.p));
        return (
          <div key={i} style={{ position: "relative", width: u(48), height: "100%", borderRadius: r(16), background: faint, overflow: "hidden", transform: `scaleX(${1 + 0.08 * moving})` }}>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${v * 100}%`, background: "var(--bc-slider)", boxShadow: "0 -1px 0 rgb(0 0 0 / .04)" }} />
            <span style={{ position: "absolute", left: 0, right: 0, bottom: u(12), display: "grid", placeItems: "center", color: "var(--bc-slider-ink)" }}>
              <Icon d={icon} size={16} />
            </span>
          </div>
        );
      })}
    </Pad>
  );
});

/** Timer Dial: a focus session counts down, the arc closing as it goes. */
export const Timer = memo(function Timer() {
  const t = useTime();
  const spring = useSpring();
  const total = 25 * 60;
  const left = 11 * 60 + 23 - t;
  const s = Math.max(0, Math.ceil(left));
  const fmt = (x: number) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  const l = 1 - (left - Math.floor(left));
  const frac = left / total;
  const R = 40;
  const len = 2 * Math.PI * R;
  const ang = -Math.PI / 2 + frac * Math.PI * 2;
  return (
    <Pad p={12} style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: u(118), height: u(118) }}>
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bc-faint)" strokeWidth="6" />
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--spb-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${len * frac} ${len}`} transform="rotate(-90 50 50)" />
          <circle cx={50 + R * Math.cos(ang)} cy={50 + R * Math.sin(ang)} r="5.5" fill="var(--bc-card)" stroke="var(--spb-accent)" strokeWidth="3" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u(2) }}>
          <Label>Focus</Label>
          <Title size={22} style={{ fontWeight: w(700) }}>
            <Roll from={fmt(s + 1)} to={fmt(s)} l={l} dur={0.32} stagger={0.03} spring={spring} />
          </Title>
        </div>
      </div>
    </Pad>
  );
});

/** Unit Toggle: the weight flips between kilograms and pounds, the figure and the ruler rolling with it. */
export const Units = memo(function Units() {
  const t = useTime();
  const spring = useSpring();
  const { from, to, p } = stepper(t, 3, 1.9, [0, 1], 0.8);
  const x = mix(from, to, spring(p));
  const vals = ["72.4", "159.6"];
  const { k, l } = cycle(t, 3, 1.9);
  return (
    <Pad p={14}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Label>Weight</Label>
        <span style={{ position: "relative", display: "flex", padding: u(2), borderRadius: pill(24), background: faint }}>
          <span style={{ position: "absolute", top: u(2), bottom: u(2), left: `calc(${u(2)} + ${u(26)} * ${x})`, width: u(26), borderRadius: pill(20), ...inner({ borderRadius: pill(20) }), boxShadow: "0 1px 2px rgb(0 0 0 / .1)" }} />
          {["kg", "lb"].map((un, i) => (
            <span key={un} style={{ position: "relative", width: u(26), height: u(20), display: "grid", placeItems: "center", fontSize: u(10.5), fontWeight: w(600), color: `color-mix(in srgb, ${ink} ${Math.round(45 + 55 * (1 - Math.abs(x - i)))}%, transparent)` }}>
              {un}
            </span>
          ))}
        </span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: u(4) }}>
        <Title size={30} style={{ fontWeight: w(700) }}>
          <Roll from={k < 0 ? vals[0] : vals[k % 2]} to={k < 0 ? vals[0] : vals[(k + 1) % 2]} l={k < 0 ? 1 : l} spring={spring} dur={0.8} />
        </Title>
      </div>
      <div style={{ position: "relative", height: u(22), overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, #000 25%, #000 75%, transparent)" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: u(5), transform: `translateX(calc(var(--k) * ${-40 - x * 60}))` }}>
          {Array.from({ length: 40 }, (_, i) => (
            <span key={i} style={{ flex: "none", width: 1.5, height: i % 5 === 0 ? u(16) : u(9), background: i % 5 === 0 ? ink : muted, opacity: i % 5 === 0 ? 0.7 : 0.4 }} />
          ))}
        </div>
        <span style={{ position: "absolute", left: "50%", bottom: 0, width: u(2.5), height: u(22), marginLeft: u(-1.25), borderRadius: u(2), background: accent }} />
      </div>
    </Pad>
  );
});

/** Swatch Picker: the look's colours, the picked one shown large with its hex. Tap one to make it the accent. */
export const Swatches = memo(function Swatches({ colors, accentHex, onPick }: { colors: Array<{ hex: string; ink: string; i: number }>; accentHex: string; onPick: (i: number) => void }) {
  const t = useTime();
  const spring = useSpring();
  const n = Math.max(1, colors.length);
  const order = Array.from({ length: n }, (_, i) => i);
  const { from, to, p } = stepper(t, 2.8, 0.7, order, 0.8);
  const x = mix(from, to, spring(p));
  const q = soft(p);
  const a = colors[from] ?? colors[0];
  const b = colors[to] ?? colors[0];
  if (!a || !b) return null;
  const hex = (h: string) => h.replace("#", "").toUpperCase();
  return (
    <Pad p={12} gap={12}>
      <div style={{ position: "relative", flex: 1, borderRadius: r(14), overflow: "hidden", background: a.hex }}>
        <div style={{ position: "absolute", inset: 0, background: b.hex, opacity: q }} />
        <span style={{ position: "absolute", left: u(12), bottom: u(10), fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: u(12), fontWeight: 600 }}>
          <span style={{ position: "absolute", left: 0, bottom: 0, color: a.ink, opacity: 1 - q }}>#{hex(a.hex)}</span>
          <span style={{ color: b.ink, opacity: q }}>#{hex(b.hex)}</span>
        </span>
        {b.hex.toLowerCase() === accentHex.toLowerCase() || a.hex.toLowerCase() === accentHex.toLowerCase() ? (
          <span style={{ position: "absolute", right: u(10), top: u(10), fontSize: u(10.5), fontWeight: 600, padding: `${u(3)} ${u(8)}`, borderRadius: pill(20), background: "rgb(255 255 255 / .85)", color: "#111", opacity: b.hex.toLowerCase() === accentHex.toLowerCase() ? q : 1 - q }}>
            Accent
          </span>
        ) : null}
      </div>
      <div style={{ position: "relative", height: u(10), borderRadius: u(5), background: `linear-gradient(90deg, ${colors.map((co) => co.hex).join(", ")})` }}>
        <span style={{ position: "absolute", top: "50%", left: `${(x / Math.max(1, n - 1)) * 100}%`, width: u(18), height: u(18), marginLeft: u(-9), marginTop: u(-9), borderRadius: "50%", background: "#fff", boxShadow: `0 1px 4px rgb(0 0 0 / .25), inset 0 0 0 ${u(4)} ${b.hex}` }} />
      </div>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, gap: u(6) }}>
        <span style={{ position: "absolute", top: u(-3), bottom: u(-3), width: `calc((100% - ${u(6 * (n - 1))}) / ${n} + ${u(6)})`, left: `calc(((100% - ${u(6 * (n - 1))}) / ${n} + ${u(6)}) * ${x} - ${u(3)})`, borderRadius: r(12), boxShadow: `inset 0 0 0 ${u(2)} ${ink}` }} />
        {colors.map((co, i) => (
          <button
            key={co.i}
            type="button"
            onClick={() => onPick(co.i)}
            aria-label={`Make #${hex(co.hex)} the accent`}
            title={`Make #${hex(co.hex)} the accent`}
            style={{ position: "relative", height: u(30), borderRadius: r(9), background: co.hex, cursor: "pointer", transform: `scale(${1 - 0.1 * (1 - Math.min(1, Math.abs(x - i)))})` }}
          />
        ))}
      </div>
    </Pad>
  );
});

const STEPS = ["Ordered", "Packed", "On the way", "Delivered"];

/** Status Timeline: an order moves through its steps, the line filling behind it. */
export const Status = memo(function Status() {
  const t = useTime();
  const spring = useSpring();
  const P = 2.1;
  const order = [0, 1, 2, 3, 3];
  const { from, to, p, i } = stepper(t, P, 0.8, order, 0.9);
  const reset = to < from;
  const fade = reset ? soft(p) : 0;
  const x = reset ? 0 : mix(from, to, spring(p));
  const shown = reset ? 0 : i;
  const label = STEPS[order[shown]];
  const prevLabel = STEPS[from];
  const q = reset ? 1 : from === to ? 1 : soft(p);
  return (
    <Pad p={14}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: u(8) }}>
          <span style={{ display: "grid", placeItems: "center", width: u(28), height: u(28), borderRadius: r(9), background: tint("var(--spb-accent)", 14), color: accent }}>
            <Icon d={ICON.box} size={15} />
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: u(1) }}>
            <Title size={12.5}>Order 4821</Title>
            <Label style={{ fontSize: u(10.5) }}>Arrives 2:40 pm</Label>
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ position: "relative", height: u(18), opacity: 1 }}>
        <span style={{ position: "absolute", left: 0, bottom: 0, ...heading, fontSize: u(15), fontWeight: w(600), color: ink, opacity: 1 - q, transform: `translateY(${-q * 8}px)` }}>{reset ? STEPS[3] : prevLabel}</span>
        <span style={{ position: "absolute", left: 0, bottom: 0, ...heading, fontSize: u(15), fontWeight: w(600), color: ink, opacity: q, transform: `translateY(${(1 - q) * 8}px)` }}>{label}</span>
      </div>
      <div style={{ position: "relative", height: u(14), marginTop: u(12), marginInline: u(6) }}>
        <span style={{ position: "absolute", left: 0, right: 0, top: "50%", height: u(3), marginTop: u(-1.5), borderRadius: u(2), background: faint }} />
        <span style={{ position: "absolute", left: 0, top: "50%", height: u(3), marginTop: u(-1.5), borderRadius: u(2), background: accent, width: `${(Math.max(0, x) / 3) * 100}%`, opacity: 1 - fade * 0 }} />
        {STEPS.map((s, j) => {
          const on = clamp01(x - j + 1);
          return <span key={s} style={{ position: "absolute", top: "50%", left: `${(j / 3) * 100}%`, width: u(14), height: u(14), marginLeft: u(-7), marginTop: u(-7), borderRadius: "50%", background: `color-mix(in srgb, ${accent} ${Math.round(on * 100)}%, var(--bc-card))`, boxShadow: on > 0.5 ? `0 0 0 ${u(3)} ${tint("var(--spb-accent)", 18)}` : `inset 0 0 0 ${u(2)} ${faint}`, transform: `scale(${0.8 + 0.2 * spring(on)})` }} />;
        })}
      </div>
    </Pad>
  );
});

/** Option Card pricing: monthly or yearly, the price rolling and the saving springing in. */
export const Pricing = memo(function Pricing() {
  const t = useTime();
  const spring = useSpring();
  const { from, to, p } = stepper(t, 3.3, 2.4, [0, 1], 0.8);
  const x = mix(from, to, spring(p));
  const { k, l } = cycle(t, 3.3, 2.4);
  const prices = ["$12", "$99"];
  const badge = to === 1 ? spring(clamp01((p - 0.2) / 0.8)) : 1 - soft(p * 2);
  return (
    <Pad p={12} gap={10}>
      <div style={{ position: "relative", display: "flex", height: u(32), padding: u(3), borderRadius: pill(32), background: faint }}>
        <span style={{ position: "absolute", top: u(3), bottom: u(3), width: `calc((100% - ${u(6)}) / 2)`, left: `calc(${u(3)} + (100% - ${u(6)}) / 2 * ${x})`, ...inner({ borderRadius: pill(26) }), boxShadow: "0 1px 2px rgb(0 0 0 / .08)" }} />
        {["Monthly", "Yearly"].map((s, i) => (
          <span key={s} style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", fontSize: u(12), fontWeight: w(600), color: `color-mix(in srgb, ${ink} ${Math.round(45 + 55 * (1 - Math.abs(x - i)))}%, transparent)` }}>
            {s}
          </span>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: u(6), paddingInline: u(4), paddingBottom: u(4) }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: u(4) }}>
          <Title size={32} style={{ fontWeight: w(700), letterSpacing: "-0.03em" }}>
            <Roll from={k < 0 ? prices[0] : prices[from]} to={k < 0 ? prices[0] : prices[to]} l={k < 0 ? 1 : l} spring={spring} dur={0.8} />
          </Title>
          <span style={{ position: "relative", fontSize: u(11), color: muted, width: u(40) }}>
            <span style={{ opacity: 1 - x }}>/ month</span>
            <span style={{ position: "absolute", left: 0, opacity: x }}>/ year</span>
          </span>
        </div>
        <span style={{ fontSize: u(10.5), fontWeight: w(600), padding: `${u(4)} ${u(9)}`, borderRadius: pill(22), background: accent, color: accentInk, opacity: clamp01(badge), transform: `scale(${0.6 + 0.4 * badge})`, whiteSpace: "nowrap" }}>Save 30%</span>
      </div>
    </Pad>
  );
});

/** Commit Button: pay, hold on, paid, as the style's buttons do it. */
export const Pay = memo(function Pay({ buttons }: { buttons: "solid" | "tinted" | "outline" | "glass" }) {
  const t = useTime();
  const spring = useSpring();
  const P = 6;
  const { k, l } = cycle(t, P, 1);
  const press = k < 0 ? 0 : Math.sin(Math.PI * clamp01(l / 0.3));
  const toLoad = k < 0 ? 0 : clamp01((l - 0.25) / 0.7);
  const toDone = k < 0 ? 0 : clamp01((l - 1.9) / 0.8);
  const back = k < 0 ? 0 : soft((l - (P - 0.9)) / 0.8);
  const narrow = spring(toLoad) * (1 - spring(toDone));
  const fill = buttons === "solid" ? accent : buttons === "outline" ? "transparent" : tint("var(--spb-accent)", 16);
  const fg = buttons === "solid" ? accentInk : accent;
  const edge = buttons === "outline" ? `inset 0 0 0 ${u(1.5)} ${accent}` : buttons === "solid" ? `0 ${u(6)} ${u(16)} ${u(-8)} ${tint("var(--spb-accent)", 80)}` : "none";
  const idle = 1 - Math.max(soft(toLoad * 1.6), 0) + back * (toDone > 0 ? 1 : 0);
  const idleO = clamp01(toDone > 0 ? back : 1 - soft(toLoad * 1.6));
  const loadO = clamp01(soft((toLoad - 0.3) * 2)) * (1 - soft(toDone * 2));
  const doneO = clamp01(soft((toDone - 0.2) * 2)) * (1 - back);
  void idle;
  return (
    <Pad p={10} style={{ justifyContent: "center", alignItems: "center" }}>
      <span style={{ position: "relative", height: u(46), width: `calc(100% - (100% - ${u(46)}) * ${narrow})`, borderRadius: `calc(var(--k) * 23 * min(1, var(--spb-corner, 1)) + var(--k) * 23 * ${narrow} * (1 - min(1, var(--spb-corner, 1))))`, background: fill, boxShadow: edge, color: fg, transform: `scale(${1 - press * 0.04})`, overflow: "hidden", backdropFilter: buttons === "glass" ? "blur(12px)" : undefined }}>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: u(7), fontSize: u(14), fontWeight: w(600), opacity: idleO, whiteSpace: "nowrap" }}>
          <Icon d={ICON.lock} size={14} />
          Pay $48.00
        </span>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: loadO }}>
          <svg viewBox="0 0 20 20" style={{ width: u(20), height: u(20), transform: `rotate(${t * 420}deg)` }}>
            <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="30 44" strokeLinecap="round" />
          </svg>
        </span>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: u(7), fontSize: u(14), fontWeight: w(600), opacity: doneO, whiteSpace: "nowrap" }}>
          <svg viewBox="0 0 20 20" style={{ width: u(16), height: u(16) }}>
            <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - clamp01((toDone - 0.15) / 0.6)} />
          </svg>
          Paid
        </span>
      </span>
    </Pad>
  );
});
