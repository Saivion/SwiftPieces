"use client";
// The studio's canvas as a bento grid: nineteen small cards, each a moment of an app built like a
// SwiftPieces component, every one of them moving at once on its own cycle (motion.ts) and all of
// them wearing the style being made. A shuffle dips the grid out and springs it back in, card by
// card across the grid, in the new style. The cards keep the canvas's quiet surfaces (surfaces.ts):
// grey trays with the style's white (or black) cards inside, three inverse cards in its ink, and
// two that take a pastel of its palette, so the style's colour shows where the style puts it.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { inkOn, mixHex, resolveTheme, type Theme } from "@swiftpieces/builder";
import { themeVars } from "@swiftpieces/builder/react";
import { FOLLOW_LABELS, reaches, type Spot, type StyleFollow } from "../follows";
import type { Scheme, Surfaces } from "../surfaces";
import * as C from "./cards";
import { SPRINGS, SpringContext, stillClock, useClockHold } from "./motion";

type Tone = "tile" | "white" | "inverse" | "feature";

type CardId = "player" | "seg" | "code" | "week" | "type" | "heat" | "toggle" | "react" | "chart" | "chat" | "tasks" | "rings" | "sliders" | "timer" | "units" | "swatch" | "status" | "pricing" | "pay";

type CardDef = { id: CardId; name: string; docs: string | null; tone: Tone; follows: StyleFollow[]; col: number; row: number };

const D = (path: string) => `/docs/components/${path}`;
const base: StyleFollow[] = ["accent", "corners", "body", "motion"];

/**
 * The cards in reading order, each with the piece it's built like (and that piece's docs), the
 * parts of a style that change it, its tone, and where it sits (column and row, for the intro).
 * Their areas are in globals.css (.bento-grid).
 */
const CARDS: CardDef[] = [
  { id: "player", name: "Now Playing", docs: D("media/now-playing"), tone: "inverse", follows: [...base, "headings", "corners"], col: 0, row: 0 },
  { id: "seg", name: "Glass Segments", docs: D("glass/glass-segments"), tone: "tile", follows: ["corners", "body", "motion", "cards"], col: 0, row: 3 },
  { id: "code", name: "Secure Entry", docs: D("inputs/secure-entry"), tone: "tile", follows: [...base, "headings", "cards"], col: 0, row: 4 },
  { id: "week", name: "Date Strip", docs: D("inputs/date-strip"), tone: "tile", follows: [...base, "headings"], col: 0, row: 6 },
  { id: "type", name: "Type", docs: null, tone: "white", follows: ["headings", "body", "titles"], col: 1, row: 0 },
  { id: "heat", name: "Activity Heatmap", docs: D("data/activity-heatmap"), tone: "feature", follows: [...base, "titles"], col: 1, row: 2 },
  { id: "toggle", name: "Liquid Switch", docs: D("controls/liquid-switch"), tone: "tile", follows: ["accent", "corners", "headings", "motion"], col: 1, row: 4 },
  { id: "react", name: "Reaction Toggle", docs: D("feedback/reaction-toggle"), tone: "tile", follows: ["accent", "titles", "motion", "cards"], col: 1, row: 6 },
  { id: "chart", name: "Odometer", docs: D("data/odometer"), tone: "white", follows: [...base, "titles"], col: 2, row: 0 },
  { id: "chat", name: "Streaming Reply", docs: D("ai/streaming-reply"), tone: "tile", follows: [...base, "cards", "headings"], col: 2, row: 3 },
  { id: "tasks", name: "Task Row", docs: D("lists/task-row"), tone: "tile", follows: [...base, "cards", "headings"], col: 2, row: 5 },
  { id: "rings", name: "Ring Breakdown", docs: D("data/ring-breakdown"), tone: "inverse", follows: ["accent", "body", "motion"], col: 3, row: 0 },
  { id: "sliders", name: "Expanding Track", docs: D("inputs/expanding-track"), tone: "tile", follows: ["corners", "motion"], col: 3, row: 2 },
  { id: "timer", name: "Timer Dial", docs: D("controls/timer-dial"), tone: "tile", follows: ["accent", "titles", "body", "motion"], col: 3, row: 4 },
  { id: "units", name: "Unit Toggle", docs: D("inputs/unit-toggle"), tone: "tile", follows: [...base, "titles"], col: 3, row: 6 },
  { id: "swatch", name: "Swatch Picker", docs: D("inputs/swatch-picker"), tone: "white", follows: ["accent", "corners", "motion"], col: 4, row: 0 },
  { id: "status", name: "Status Timeline", docs: D("lists/status-timeline"), tone: "feature", follows: [...base, "headings"], col: 4, row: 3 },
  { id: "pricing", name: "Choice Group", docs: D("inputs/choice-group"), tone: "tile", follows: [...base, "titles", "cards"], col: 4, row: 5 },
  { id: "pay", name: "Commit Button", docs: D("controls/commit-button"), tone: "tile", follows: ["accent", "buttons", "corners", "body", "motion"], col: 4, row: 7 },
];

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A spring as a CSS linear() easing, so the intro and the rise take the style's own spring. */
function springEasing(motion: keyof typeof SPRINGS) {
  const f = SPRINGS[motion];
  return `linear(${Array.from({ length: 41 }, (_, i) => f(i / 40).toFixed(4)).join(", ")})`;
}

const DIPPED: Keyframe = { opacity: 0.35, filter: "blur(5px)", transform: "translateY(4px) scale(0.97)" };

/**
 * A card's part in the grid's motion: it springs in on arrival (staggered by where it sits), dips
 * out with the rest when a new style is on its way, and springs back in, in turn, when it's drawn.
 */
function useCardMotion(def: CardDef, wave: number, leaving: boolean, easing: string) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation | null>(null);
  const delay = (def.col * 55 + def.row * 30);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    motion.current = el.animate([{ opacity: 0, transform: "scale(0.86)" }, { opacity: 1, transform: "none" }], { duration: 900, delay: 120 + delay, easing, fill: "backwards" });
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!leaving || !el || reduced()) return;
    const now = getComputedStyle(el);
    motion.current?.cancel();
    motion.current = el.animate([{ opacity: now.opacity, filter: now.filter === "none" ? "blur(0px)" : now.filter, transform: now.transform }, DIPPED], { id: "dip", duration: 130, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
  }, [leaving]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!wave || !el || reduced()) return;
    motion.current?.cancel();
    motion.current = el.animate([DIPPED, { opacity: 1, filter: "blur(0px)", transform: "none" }], { duration: 760, delay: delay * 0.6, easing, fill: "backwards" });
  }, [wave]);
  return ref;
}

type Props = {
  theme: Theme;
  scheme: Scheme;
  surfaces: Surfaces;
  wave: number;
  leaving: boolean;
  flash: { n: number; spot: Spot | null };
  spot: Spot | null;
  onEdit: (patch: Partial<Theme>) => void;
};

export function BentoCanvas({ theme, scheme, surfaces, wave, leaving, flash, spot, onEdit }: Props) {
  const r = useMemo(() => resolveTheme(theme), [theme]);
  const look = r.look[scheme];
  const accent = r.accent[scheme];
  const text = look.text;

  // Grid-wide colours: the style's ink and its greys over the canvas's surfaces, the look's palette
  // for the cards that use more than the accent, and the inverse card (the ink in light, a lifted
  // black in dark).
  const vars = useMemo(() => {
    const palette = look.tiles.filter((h) => h.toLowerCase() !== accent.toLowerCase());
    const pick = (i: number) => palette[i % Math.max(1, palette.length)] ?? accent;
    const inverse = scheme === "light" ? mixHex(surfaces.ramp[7], surfaces.ramp[6], 0.15) : mixHex(surfaces.card, "#ffffff", 0.11);
    const inverseInk = scheme === "light" ? surfaces.ramp[0] : "#ffffff";
    return {
      ...themeVars(r, scheme),
      ["--bc-ink" as string]: text,
      ["--bc-muted" as string]: `color-mix(in srgb, ${text} 55%, transparent)`,
      ["--bc-faint" as string]: `color-mix(in srgb, ${text} 8%, transparent)`,
      ["--bc-card" as string]: r.cards === "glass" ? `color-mix(in srgb, ${surfaces.card} 70%, transparent)` : surfaces.card,
      ["--bc-card-solid" as string]: surfaces.card,
      ["--bc-edge" as string]: r.cards === "flat" ? "none" : "var(--spb-card-edge-on, none)",
      ["--bc-inverse" as string]: inverse,
      ["--bc-inverse-ink" as string]: inverseInk,
      ["--bc-slider" as string]: scheme === "light" ? surfaces.card : `color-mix(in srgb, ${text} 88%, transparent)`,
      ["--bc-slider-ink" as string]: scheme === "light" ? text : surfaces.card,
      ["--bc-switch-off" as string]: `color-mix(in srgb, ${text} 16%, transparent)`,
      ["--bc-c1" as string]: pick(0),
      ["--bc-c2" as string]: pick(1),
      ["--bc-c3" as string]: pick(2),
      ["--bc-c4" as string]: pick(3),
      ["--bc-c5" as string]: pick(4),
      ["--spb-title-k" as string]: String(r.titleScale),
      fontFamily: "var(--spb-font, inherit)",
      fontStretch: r.fontStretch,
      letterSpacing: r.letterSpacing,
    } as CSSProperties;
  }, [r, scheme, surfaces, look, accent, text]);

  const inverseVars = useMemo(() => {
    const ink = scheme === "light" ? surfaces.ramp[0] : "#ffffff";
    return {
      ["--bc-ink" as string]: ink,
      ["--bc-muted" as string]: `color-mix(in srgb, ${ink} 55%, transparent)`,
      ["--bc-faint" as string]: `color-mix(in srgb, ${ink} 14%, transparent)`,
      ["--bc-card" as string]: `color-mix(in srgb, ${ink} 10%, transparent)`,
      ["--bc-card-solid" as string]: scheme === "light" ? surfaces.ramp[7] : "#000000",
      ["--bc-edge" as string]: "none",
    } as CSSProperties;
  }, [scheme, surfaces]);

  const swatches = useMemo(
    () =>
      look.tiles
        .map((hex, i) => ({ hex, i, ink: inkOn(hex) }))
        .filter((s) => /^#[0-9a-f]{6}$/i.test(s.hex))
        .slice(0, 5),
    [look],
  );

  const ground = (tone: Tone) => (tone === "feature" ? surfaces.feature : tone === "white" ? surfaces.card : tone === "inverse" ? (vars as Record<string, string>)["--bc-inverse"] : surfaces.tile);
  const easing = useMemo(() => springEasing(r.motion), [r.motion]);

  // The clock runs while the grid is on screen; reduced motion holds it at a still moment.
  const root = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  const [still] = useState(reduced);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (still) stillClock();
  }, [still]);
  useClockHold(offscreen || still);

  const body = (id: CardId): ReactNode => {
    switch (id) {
      case "player": return <C.Player />;
      case "seg": return <C.Segments />;
      case "code": return <C.Code />;
      case "week": return <C.Week />;
      case "type": return <C.TypeCard headingName={r.heading.name} bodyName={r.body.name} />;
      case "heat": return <C.Heat />;
      case "toggle": return <C.Toggle />;
      case "react": return <C.React_ />;
      case "chart": return <C.Balance />;
      case "chat": return <C.Chat />;
      case "tasks": return <C.Tasks />;
      case "rings": return <C.Rings />;
      case "sliders": return <C.Sliders />;
      case "timer": return <C.Timer />;
      case "units": return <C.Units />;
      case "swatch": return <C.Swatches colors={swatches} accentHex={accent} onPick={(i) => onEdit({ accent: i, accentHex: undefined })} />;
      case "status": return <C.Status />;
      case "pricing": return <C.Pricing />;
      case "pay": return <C.Pay buttons={r.buttons} />;
    }
  };

  return (
    <SpringContext.Provider value={SPRINGS[r.motion]}>
      <div ref={root} className="bento-host size-full" style={vars}>
        <div className="bento-grid size-full">
          {CARDS.map((def) => (
            <BentoTile key={def.id} def={def} ground={ground(def.tone)} style={def.tone === "inverse" ? inverseVars : undefined} ink={def.tone === "inverse" ? (inverseVars as Record<string, string>)["--bc-ink"] : text} scheme={def.tone === "inverse" ? (scheme === "light" ? "dark" : "light") : scheme} wave={wave} leaving={leaving} flash={flash} spot={spot} easing={easing}>
              {body(def.id)}
            </BentoTile>
          ))}
        </div>
      </div>
    </SpringContext.Provider>
  );
}

/**
 * One card of the grid: its tone, its content, and a quiet label (the piece it's built like, a link
 * to its docs) that shows while the pointer is on it. Pointed at from the panel, a setting that
 * changes it outlines it and one that doesn't dims it; an edit that changed it flashes once.
 */
function BentoTile({ def, ground, ink, scheme, style, wave, leaving, flash, spot, easing, children }: { def: CardDef; ground: string; ink: string; scheme: Scheme; style?: CSSProperties; wave: number; leaving: boolean; flash: { n: number; spot: Spot | null }; spot: Spot | null; easing: string; children: ReactNode }) {
  const settle = useCardMotion(def, wave, leaving, easing);
  const lit = spot && spot.reach !== "all" ? reaches(spot.reach, def.follows) : null;
  const parts = lit && Array.isArray(spot!.reach) ? spot!.reach.filter((f) => def.follows.includes(f)) : [];
  const ring = useRef<HTMLSpanElement>(null);
  const { n, spot: changed } = flash;
  useEffect(() => {
    if (!n || !changed || changed.reach === "all" || !ring.current || reduced() || !reaches(changed.reach, def.follows)) return;
    ring.current.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { opacity: 0 }], { duration: 1100, easing: "ease-out" });
  }, [n, changed, def.follows]);

  return (
    <section aria-label={def.name} data-card={def.id} data-scheme={scheme} className="group/tile spb-phone-screen relative min-h-0 min-w-0" style={{ ...style, transition: "opacity 250ms var(--ease-out)", opacity: lit === false ? 0.3 : 1 }}>
      <div ref={settle} className="absolute inset-0 overflow-hidden" style={{ borderRadius: "var(--bento-r)", backgroundColor: ground, transition: "background-color 500ms var(--ease-out)" }}>
        {children}
        <span ref={ring} aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-200" style={{ boxShadow: `inset 0 0 0 1.5px ${ink}`, opacity: lit ? 0.55 : 0 }} />
      </div>
      <div className={`pointer-events-none absolute top-1.5 right-1.5 z-10 flex max-w-[calc(100%-12px)] items-center gap-1.5 rounded-full px-2 py-1 text-[10.5px] leading-none font-semibold shadow-[0_1px_3px_rgb(0_0_0/.12)] transition-opacity duration-200 group-hover/tile:opacity-100 ${parts.length ? "opacity-100" : "opacity-0"}`} style={{ background: ink, color: ground }}>
        {def.docs ? (
          <a href={def.docs} className="pointer-events-auto truncate hover:underline">
            {def.name}
          </a>
        ) : (
          <span className="truncate">{def.name}</span>
        )}
        {parts.length ? <span className="flex-none opacity-70">· {parts.map((p) => FOLLOW_LABELS[p]).join(" · ")}</span> : null}
      </div>
    </section>
  );
}
