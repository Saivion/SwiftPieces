"use client";
// The Style tab: one style for every screen, whichever app it came from, and everything in it is
// something the exported SwiftUI sets too. Shuffle makes a new, coherent style each time (a mood's
// rules over colour, type, shape and feel; core/shuffle.ts), keeps what is locked, remembers where it
// has been, and names what it makes. A style travels as a short code.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FONT_CATEGORIES, bodyFonts, fontById, fontIds, fonts, webFontsHref } from "../../core/fonts.js";
import { lookById, themeFromLook } from "../../core/looks.js";
import type { Theme } from "../../core/schema.js";
import { STYLE_SECTIONS, decodeStyle, encodeStyle, moods, newSeed, shuffleTheme, styleSpace, type StyleSection } from "../../core/shuffle.js";
import { UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { usePlay } from "./store.js";
import { loadFontsHref } from "./style-fonts.js";

/**
 * Accents beyond each look's own palette: a wide spread of hues, from vivid to soft, then neutrals.
 * The panel shows the look's colours first and fills out three even rows of twelve from these.
 */
const ACCENTS = [
  "#FF3B30", "#FF6A3D", "#FF9500", "#FFB800", "#FFD60A", "#C5E83A", "#34C759", "#10B981", "#0F766E", "#00C7BE", "#30B0C7", "#32ADE6",
  "#007AFF", "#1E3A8A", "#4F46E5", "#5856D6", "#8B5CF6", "#AF52DE", "#D946EF", "#FF2D55", "#F472B6", "#FB7185", "#9F1239", "#FFB4A2",
  "#B5E48C", "#A0C4FF", "#CDB4DB", "#A2845E", "#8E8E93", "#1C1C1E",
];
/** Swatches in the accent row: one row of twelve (the last one is the custom picker). */
const ACCENT_SLOTS = 12;
/**
 * The presets: Swift Pieces (the default), then three finished styles that each set everything at
 * once (colour, type, weight, shape and feel), so one tap shows how far a style can go.
 */
const PRESETS: Array<{ id: string; label: string; colors: string[]; theme: () => Theme }> = [
  { id: "pieces", label: "Swift Pieces", colors: [], theme: () => themeFromLook("pieces") },
  {
    id: "citrus", label: "Citrus Pop", colors: ["#FF9500", "#FFD60A", "#FF8FB8", "#8EE3B2", "#8CC4FF"],
    theme: () => ({ ...themeFromLook("candy"), name: "Citrus Pop", accentHex: "#FF9500", appearance: "light", font: "rounded", weight: "bold", corners: "round", density: "roomy", cards: "raised", symbols: "fill", motion: "bouncy", backdrop: "glow", neutrals: "warm", hierarchy: "dramatic", buttons: "solid", entrance: "rise" }),
  },
  {
    id: "lagoon", label: "Lagoon Glass", colors: ["#32ADE6", "#5CE1E6", "#8CC4FF", "#A48BFF", "#8EE3B2"],
    theme: () => ({ ...themeFromLook("frost"), name: "Lagoon Glass", accentHex: "#32ADE6", appearance: "dark", font: "avenir-next", weight: "medium", corners: "soft", density: "regular", cards: "glass", symbols: "hierarchical", motion: "smooth", backdrop: "mesh", neutrals: "cool", darkGround: "graphite", numbers: "tabular", buttons: "glass", entrance: "fade" }),
  },
  {
    id: "brass", label: "Brass & Plum", colors: ["#D9B271", "#B08CC9", "#D1737F", "#5FAE8C", "#7F9FE0"],
    theme: () => ({ ...themeFromLook("velvet"), name: "Brass & Plum", accentHex: "#D9B271", appearance: "dark", font: "iowan", weight: "regular", corners: "soft", density: "roomy", cards: "outlined", symbols: "outline", motion: "smooth", backdrop: "glow", neutrals: "warm", contrast: "soft", hierarchy: "dramatic", buttons: "outline", entrance: "fade", mascot: "hidden" }),
  },
];

/** The accent row's other hues: one of each around the wheel, then a warm neutral and ink. */
const SPREAD = ["#FF3B30", "#FF9500", "#FFD60A", "#34C759", "#00C7BE", "#32ADE6", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#A2845E", "#1C1C1E"];

/** Two colours close enough to read as the same swatch. */
function near(a: string, b: string) {
  const rgb = (h: string) => h.replace("#", "").match(/../g)?.map((x) => parseInt(x, 16)) ?? [0, 0, 0];
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90;
}

/** A grey, black or white: its channels barely differ. */
function isNeutral(hex: string) {
  const n = hex.replace("#", "").match(/../g)?.map((x) => parseInt(x, 16)) ?? [];
  return n.length === 3 && Math.max(...n) - Math.min(...n) < 28;
}

const WEIGHT_CSS: Record<Theme["weight"], number> = { light: 300, regular: 400, medium: 500, bold: 700, heavy: 800 };
const CORNER_PX: Record<Theme["corners"], number> = { square: 0, tight: 3, standard: 6, soft: 9, round: 12 };

/**
 * A preset at a glance, as a tiny screen in it: its ground, "Aa" in its font and weight, a button in
 * its accent with its corners, and three of its colours. Colour, type and shape in one look.
 */
function PresetPreview({ theme, colors }: { theme: Theme; colors: string[] }) {
  const look = lookById(theme.look);
  const scheme = theme.appearance === "system" ? look.signature : theme.appearance;
  const pal = look[scheme];
  const accent = theme.accentHex ?? pal.accent;
  const font = fontById(theme.font);
  const r = CORNER_PX[theme.corners] ?? 6;
  return (
    <span className="spp-preset" aria-hidden style={{ background: pal.bg, color: pal.text, borderRadius: Math.min(r, 8), ["--preset-bg" as string]: pal.bg }}>
      <span className="spp-preset-type" style={{ fontFamily: font.css, fontWeight: WEIGHT_CSS[theme.weight] ?? 400 }}>Aa</span>
      <span className="spp-preset-side">
        <span className="spp-preset-dots">
          {colors.slice(0, 3).map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </span>
        <span className="spp-preset-button" style={{ background: accent, borderRadius: r === 12 ? 999 : r }} />
      </span>
    </span>
  );
}

type Opt<T extends string> = Array<[T, string]>;
const GROUNDS: Opt<NonNullable<Theme["ground"]>> = [["look", "Preset"], ["tinted", "Tinted"], ["plain", "Plain"]];
const BACKDROPS: Opt<NonNullable<Theme["backdrop"]>> = [["none", "None"], ["glow", "Glow"], ["gradient", "Wash"], ["mesh", "Mesh"], ["grid", "Dots"], ["paper", "Paper"]];
const CONTRASTS: Opt<NonNullable<Theme["contrast"]>> = [["soft", "Soft"], ["standard", "Standard"], ["high", "High"]];
const NEUTRALS: Opt<NonNullable<Theme["neutrals"]>> = [["neutral", "Neutral"], ["warm", "Warm"], ["cool", "Cool"]];
const DARK_GROUNDS: Opt<NonNullable<Theme["darkGround"]>> = [["look", "Preset"], ["black", "Black"], ["graphite", "Graphite"]];
const NUMBERS: Opt<NonNullable<Theme["numbers"]>> = [["default", "Default"], ["tabular", "Tabular"]];
const HIERARCHIES: Opt<NonNullable<Theme["hierarchy"]>> = [["flat", "Flat"], ["balanced", "Balanced"], ["dramatic", "Dramatic"]];
const BUTTONS: Opt<NonNullable<Theme["buttons"]>> = [["solid", "Solid"], ["tinted", "Tinted"], ["outline", "Outline"], ["glass", "Glass"]];
const ENTRANCES: Opt<NonNullable<Theme["entrance"]>> = [["none", "None"], ["fade", "Fade"], ["rise", "Rise"]];
const MASCOTS: Opt<NonNullable<Theme["mascot"]>> = [["shown", "Shown"], ["hidden", "Hidden"]];
const HEADERS: Opt<NonNullable<Theme["headers"]>> = [["split", "Two-weight"], ["bold", "Bold"], ["centered", "Centered"]];
const BUTTON_SIZES: Opt<NonNullable<Theme["buttonSize"]>> = [["compact", "Compact"], ["regular", "Regular"], ["large", "Large"]];
const ICON_SIZES: Opt<NonNullable<Theme["iconScale"]>> = [["small", "Small"], ["medium", "Medium"], ["large", "Large"]];
const LIST_STYLES: Array<[NonNullable<Theme["lists"]> | "own", string]> = [["own", "App's"], ["cards", "Cards"], ["grouped", "Grouped"], ["plain", "Plain"]];
const TAB_STYLES: Array<[NonNullable<Theme["tabStyle"]> | "own", string]> = [["own", "App's"], ["dock", "Dock"], ["glass", "Glass"], ["system", "System"]];
const WIDTHS: Opt<NonNullable<Theme["width"]>> = [["compressed", "Narrow"], ["condensed", "Condensed"], ["standard", "Normal"], ["expanded", "Wide"]];
const TRACKINGS: Opt<NonNullable<Theme["tracking"]>> = [["tight", "Tight"], ["normal", "Normal"], ["wide", "Loose"]];
const TEXT_SIZES: Opt<Theme["textSize"]> = [["default", "Default"], ["large", "Large"], ["xlarge", "XL"], ["xxlarge", "XXL"]];
const WEIGHTS: Opt<Theme["weight"]> = [["light", "Light"], ["regular", "Regular"], ["medium", "Medium"], ["bold", "Bold"], ["heavy", "Heavy"]];
const CORNERS: Array<[Theme["corners"], string, number]> = [["square", "Square", 0], ["tight", "Tight", 3], ["standard", "Standard", 7], ["soft", "Soft", 10], ["round", "Round", 14]];
const DENSITIES: Opt<Theme["density"]> = [["compact", "Compact"], ["regular", "Regular"], ["roomy", "Roomy"], ["airy", "Airy"]];
const CARDS: Opt<NonNullable<Theme["cards"]>> = [["flat", "Flat"], ["raised", "Raised"], ["outlined", "Outlined"], ["glass", "Glass"], ["bold", "Bold"]];
const SYMBOLS: Opt<NonNullable<Theme["symbols"]>> = [["outline", "Outline"], ["fill", "Filled"], ["hierarchical", "Two-tone"]];
const MOTIONS: Opt<NonNullable<Theme["motion"]>> = [["smooth", "Smooth"], ["snappy", "Snappy"], ["bouncy", "Bouncy"]];

/** A big count, written the way people say it ("297 trillion"). */
function spoken(n: number): string {
  const units: Array<[number, string]> = [[1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"], [1e6, "million"]];
  const hit = units.find(([u]) => n >= u);
  return hit ? `${Math.floor(n / hit[0])} ${hit[1]}` : n.toLocaleString("en-US");
}

type History = { list: Theme[]; at: number };

export const StylePanel = memo(function StylePanel() {
  const { store } = usePlayground();
  const project = usePlay(store, (s) => s.project);
  const base = usePlay(store, (s) => s.base);
  const [locks, setLocks] = useState<Set<StyleSection>>(() => new Set());
  const [history, setHistory] = useState<History>({ list: [], at: -1 });
  const [moodId, setMoodId] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);
  const [copied, setCopied] = useState(false);
  const count = useMemo(() => spoken(styleSpace()), []);

  // Every font tile draws its "Aa" in its own font: the stand-ins for all of them, just those glyphs.
  useEffect(() => loadFontsHref(webFontsHref(fontIds.filter((id) => id !== "default"), "Aa")), []);

  const theme = project?.theme;
  // Any change on plain iOS styling starts from the house look.
  const t: Theme = theme ?? themeFromLook("pieces");
  const tRef = useRef(t);
  tRef.current = t;
  // Each control changes the style as it is now (not as it was when this panel last drew).
  const set = useCallback((p: Partial<Theme>) => {
    const next: Theme = { ...tRef.current, ...p };
    for (const k of Object.keys(p) as Array<keyof Theme>) if (p[k] === undefined) delete next[k];
    // A hand-made change is no longer the shuffled style the name described.
    delete next.name;
    // Picking a preset's colours replaces exact ones from a screenshot.
    if (["look", "ground", "neutrals", "contrast", "darkGround"].some((k) => k in p)) delete next.custom;
    store.setTheme(next);
  }, [store]);

  const remember = useCallback((next: Theme) => {
    setHistory((h) => {
      const list = h.at < 0 ? [tRef.current] : h.list.slice(0, h.at + 1);
      const trimmed = [...list, next].slice(-50);
      return { list: trimmed, at: trimmed.length - 1 };
    });
  }, []);

  const shuffle = useCallback(() => {
    // The styles you've just seen (this panel's history), so Shuffle never serves a near-rerun.
    const { theme: next, mood } = shuffleTheme(newSeed(), tRef.current, locks, history.list.slice(-8));
    setMoodId(mood.id);
    remember(next);
    store.setTheme(next);
  }, [locks, remember, store, history.list]);

  const go = (step: -1 | 1) => {
    const at = history.at + step;
    const to = history.list[at];
    if (!to) return;
    setHistory({ ...history, at });
    setMoodId(null);
    store.setTheme(to);
  };

  // S shuffles (outside text fields), as in design tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "s" && e.key !== "S") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      shuffle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shuffle]);

  if (!project) return <div className="spp-pane-loading" />;
  const look = lookById(t.look);
  const changed = JSON.stringify(theme ?? null) !== JSON.stringify(base?.theme ?? null);
  const code = encodeStyle(t);
  const mood = moods.find((m) => m.id === moodId) ?? null;
  const toggleLock = (s: StyleSection) =>
    setLocks((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  // The row: the preset's accent and up to four of its colours, then other hues, then any colour.
  const ownTiles = look.dark.tiles.slice(0, 4);
  const extraAccents = SPREAD.filter((c) => ![look.dark.accent, ...ownTiles].some((x) => near(x, c))).slice(0, ACCENT_SLOTS - 2 - ownTiles.length);
  const shownHex = new Set([...ownTiles, ...extraAccents].map((c) => c.toUpperCase()));
  const custom = t.accentHex && !shownHex.has(t.accentHex.toUpperCase()) ? t.accentHex : null;

  return (
    <div className="spp-compose spp-style">
      <div className="spp-shuffle">
        {/* The style's name, and a way back through what shuffling has made. */}
        <div className="spp-shuffle-head">
          <div className="spp-shuffle-name">
            <span className="spp-shuffle-eyebrow">{mood ? `${mood.name} mood` : theme ? "This style" : "Plain iOS"}</span>
            <strong key={t.name ?? look.name}>{t.name ?? (theme ? look.name : "iOS")}</strong>
          </div>
          <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={() => go(-1)} disabled={history.at <= 0} aria-label="Previous style" title="Previous style">
            <UI name="left" size={14} />
          </button>
          <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={() => go(1)} disabled={history.at < 0 || history.at >= history.list.length - 1} aria-label="Next style" title="Next style">
            <UI name="right" size={14} />
          </button>
          {changed && base ? (
            <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={() => (remember(base.theme ?? themeFromLook("pieces")), setMoodId(null), store.setTheme(base.theme))} aria-label="Back to the original style" title="Back to the original style">
              <UI name="restart" size={13} />
            </button>
          ) : null}
        </div>
        {/* Shuffle, drawn like an open artboard: a fine dashed edge with a cross on each corner. */}
        <button type="button" className="spp-frame spp-shuffle-go" onClick={shuffle} title={`A new style (S). ${count} styles, every one exports to Xcode.`}>
          <span className="spp-frame-tick" data-at="tl" aria-hidden />
          <span className="spp-frame-tick" data-at="tr" aria-hidden />
          <span className="spp-frame-tick" data-at="bl" aria-hidden />
          <span className="spp-frame-tick" data-at="br" aria-hidden />
          <span className="spp-shuffle-wash" aria-hidden />
          <UI name="shuffle" size={14} />
          Shuffle Style
        </button>
        {/* What stays put: four equal toggles in one track. */}
        <div className="spp-shuffle-section">
          <span className="spp-shuffle-label">Keep while shuffling</span>
          <div className="spp-shuffle-locks" role="group" aria-label="Keep while shuffling">
            {STYLE_SECTIONS.map((s) => (
              <button key={s.id} type="button" className="spp-lock-chip" aria-pressed={locks.has(s.id)} onClick={() => toggleLock(s.id)} title={locks.has(s.id) ? `${s.label} stays as it is` : `Keep ${s.label.toLowerCase()} when shuffling`}>
                <UI name={locks.has(s.id) ? "lock" : "lockOpen"} size={11} />
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="spp-shuffle-section">
          <span className="spp-shuffle-label">Style code</span>
        <div className="spp-shuffle-code">
          {pasting ? (
            <form
              className="spp-code-form"
              onSubmit={(e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get("code");
                const decoded = decodeStyle(String(value ?? ""));
                if (!decoded) return store.notify("That isn't a style code.");
                remember(decoded);
                setMoodId(null);
                store.setTheme(decoded);
                setPasting(false);
              }}
            >
              <input name="code" className="spp-code-input" placeholder="SP1-…" onKeyDown={(e) => e.key === "Escape" && setPasting(false)} autoFocus spellCheck={false} autoComplete="off" aria-label="Style code" />
              <button type="submit" className="spp-icon-btn spp-icon-btn-sm" aria-label="Apply the style code" title="Apply (Return)">
                <UI name="check" size={13} />
              </button>
              <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={() => setPasting(false)} aria-label="Cancel" title="Cancel (Esc)">
                <UI name="close" size={12} />
              </button>
            </form>
          ) : (
            <>
              <code title="This style as a code: paste it into any Playground to get it back">{code}</code>
              <button
                type="button"
                className="spp-icon-btn spp-icon-btn-sm"
                aria-label="Copy the style code"
                title="Copy the style code"
                onClick={() => {
                  void navigator.clipboard?.writeText(code).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1400);
                  }, () => {});
                }}
              >
                <UI name={copied ? "check" : "copy"} size={12} />
              </button>
              <button type="button" className="spp-icon-btn spp-icon-btn-sm" onClick={() => setPasting(true)} aria-label="Paste a style code" title="Paste a style code">
                <UI name="paste" size={12} />
              </button>
            </>
          )}
        </div>
        </div>
      </div>

      <Section title="Presets">
        <div className="spp-looks" role="radiogroup" aria-label="Preset">
          {PRESETS.map((pr) => {
            const look = lookById(pr.id === "pieces" ? "pieces" : pr.theme().look);
            // Swift Pieces shows its own palette; the others show the colours they set.
            const colors = pr.colors.length ? pr.colors : [...new Set([look.dark.accent, ...look.dark.tiles].map((x) => x.toLowerCase()))].filter((x) => !isNeutral(x));
            // Swift Pieces is on when the style is exactly the house look (light or dark either way).
            const house = themeFromLook("pieces");
            const on = pr.id === "pieces" ? !theme || encodeStyle({ ...theme, appearance: house.appearance }) === encodeStyle(house) : theme?.name === pr.label;
            return (
              <button key={pr.id} type="button" role="radio" aria-checked={on} className="spp-look" onClick={() => store.setTheme(pr.theme())}>
                <PresetPreview theme={pr.theme()} colors={colors} />
                <span>{pr.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Everything else as quiet rows: a label and one compact control each. The rarer settings
          wait under More. */}
      <section className="spp-section spp-style-rows">
        <h2 className="spp-label">Color</h2>
        <div className="spp-swatches" role="radiogroup" aria-label="Accent">
          <button type="button" role="radio" aria-checked={!t.accentHex && t.accent === -1} className="spp-swatch" title="The preset's own accent" aria-label="The preset's own accent" style={{ ["--sw" as string]: look.dark.accent }} onClick={() => set({ accent: -1, accentHex: undefined })} />
          {ownTiles.map((c, i) => (
            <button key={i} type="button" role="radio" aria-checked={!t.accentHex && t.accent === i} className="spp-swatch" style={{ ["--sw" as string]: c }} onClick={() => set({ accent: i, accentHex: undefined })} aria-label={`${look.name} colour ${i + 1}`} title={`From ${look.name}`} />
          ))}
          {extraAccents.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={t.accentHex?.toUpperCase() === c} className="spp-swatch" style={{ ["--sw" as string]: c }} onClick={() => set({ accentHex: c })} aria-label={`Accent ${c}`} title={c} />
          ))}
          {/* Any colour: the picker, showing the current one when it's off the row (a shuffled accent). */}
          <label className="spp-swatch spp-swatch-any" role="radio" aria-checked={Boolean(custom)} title={custom ? `Custom ${custom}` : "Any colour"} style={custom ? { ["--sw" as string]: custom } : undefined}>
            <input type="color" value={(custom ?? t.accentHex ?? "#FF0000").toLowerCase()} onChange={(e) => set({ accentHex: e.target.value.toUpperCase() })} aria-label="Any accent colour" />
          </label>
        </div>
        <Row label="Background">
          <MiniSeg label="Background" value={t.ground ?? "look"} options={GROUNDS} onChange={(v) => set({ ground: v === "look" ? undefined : (v as Theme["ground"]) })} />
        </Row>
        <Row label="Contrast">
          <MiniSeg label="Contrast" value={t.contrast ?? "standard"} options={CONTRASTS} onChange={(v) => set({ contrast: v === "standard" ? undefined : (v as Theme["contrast"]) })} />
        </Row>
        <Row label="Greys">
          <MiniSeg label="Greys" value={t.neutrals ?? "neutral"} options={NEUTRALS} onChange={(v) => set({ neutrals: v === "neutral" ? undefined : (v as Theme["neutrals"]) })} />
        </Row>
        <Row label="Dark mode">
          <MiniSeg label="Dark mode ground" value={t.darkGround ?? "look"} options={DARK_GROUNDS} onChange={(v) => set({ darkGround: v === "look" ? undefined : (v as Theme["darkGround"]) })} />
        </Row>
      </section>

      <section className="spp-section spp-style-rows">
        <h2 className="spp-label">Type</h2>
        <Row label="Headings">
          <FontSelect label="Headings" value={t.headingFont ?? null} body={t.font} onChange={(id) => set({ headingFont: id === null || id === t.font ? undefined : id })} />
        </Row>
        <Row label="Body">
          <FontSelect label="Body" value={t.font} bodyOnly onChange={(id) => set({ font: id ?? "default", ...(t.headingFont === id ? { headingFont: undefined } : {}) })} />
        </Row>
        <Row label="Size">
          <MiniSeg label="Text size" value={t.textSize} options={TEXT_SIZES} onChange={(v) => set({ textSize: v as Theme["textSize"] })} />
        </Row>
        <Row label="Headers">
          <MiniSeg label="Headers" value={t.headers ?? "split"} options={HEADERS} onChange={(v) => set({ headers: v === "split" ? undefined : (v as Theme["headers"]) })} />
        </Row>
        <Row label="Titles">
          <MiniSeg label="Title hierarchy" value={t.hierarchy ?? "balanced"} options={HIERARCHIES} onChange={(v) => set({ hierarchy: v === "balanced" ? undefined : (v as Theme["hierarchy"]) })} />
        </Row>
        <Row label="Numbers">
          <MiniSeg label="Numbers" value={t.numbers ?? "default"} options={NUMBERS} onChange={(v) => set({ numbers: v === "default" ? undefined : (v as Theme["numbers"]) })} />
        </Row>
        <Row label="Weight">
          <div className="spp-seg spp-seg-fill spp-seg-sm" role="radiogroup" aria-label="Weight">
            {WEIGHTS.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={t.weight === v} onClick={() => set({ weight: v })} title={l} aria-label={l}>
                <span style={{ fontWeight: WEIGHT_CSS[v] }}>Aa</span>
              </button>
            ))}
          </div>
        </Row>
      </section>

      <section className="spp-section spp-style-rows">
        <h2 className="spp-label">Shape</h2>
        <Row label="Corners">
          <div className="spp-seg spp-seg-fill spp-seg-sm" role="radiogroup" aria-label="Corners">
            {CORNERS.map(([v, label, r]) => (
              <button key={v} type="button" role="radio" aria-checked={t.corners === v} onClick={() => set({ corners: v })} title={label} aria-label={label}>
                <span className="spp-corner-sample ai ai-pop" style={{ borderTopLeftRadius: r * 0.7 }} aria-hidden />
              </button>
            ))}
          </div>
        </Row>
        <Row label="Cards">
          <div className="spp-seg spp-seg-fill spp-seg-sm" role="radiogroup" aria-label="Cards">
            {CARDS.map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={(t.cards ?? "flat") === v} data-card={v} onClick={() => set({ cards: v === "flat" ? undefined : v })} title={label} aria-label={label}>
                <span className="spp-card-sample ai ai-pop" aria-hidden />
              </button>
            ))}
          </div>
        </Row>
        <Row label="Lists">
          <MiniSeg label="Lists" value={t.lists ?? "own"} options={LIST_STYLES} onChange={(v) => set({ lists: v === "own" ? undefined : (v as Theme["lists"]) })} />
        </Row>
        <Row label="Buttons">
          <MiniSeg label="Buttons" value={t.buttons ?? "solid"} options={BUTTONS} onChange={(v) => set({ buttons: v === "solid" ? undefined : (v as Theme["buttons"]) })} />
        </Row>
        <Row label="Button size">
          <MiniSeg label="Button size" value={t.buttonSize ?? "regular"} options={BUTTON_SIZES} onChange={(v) => set({ buttonSize: v === "regular" ? undefined : (v as Theme["buttonSize"]) })} />
        </Row>
        <Row label="Spacing">
          <MiniSeg label="Spacing" value={t.density} options={DENSITIES} onChange={(v) => set({ density: v as Theme["density"] })} />
        </Row>
      </section>

      <details className="spp-style-more">
        <summary>
          <UI name="right" size={12} />
          More
          <span>Backdrop, letters, icons, tab bar, motion</span>
        </summary>
        <div className="spp-style-rows">
          <Row label="Backdrop">
            <MiniSeg label="Backdrop" value={t.backdrop ?? "none"} options={BACKDROPS} onChange={(v) => set({ backdrop: v === "none" ? undefined : (v as Theme["backdrop"]) })} />
          </Row>
          <Row label="Width">
            <MiniSeg label="Width" value={t.width ?? "standard"} options={WIDTHS} onChange={(v) => set({ width: v === "standard" ? undefined : (v as Theme["width"]) })} />
          </Row>
          <Row label="Letters">
            <MiniSeg label="Letter spacing" value={t.tracking ?? "normal"} options={TRACKINGS} onChange={(v) => set({ tracking: v === "normal" ? undefined : (v as Theme["tracking"]) })} />
          </Row>
          <Row label="Symbols">
            <MiniSeg label="Symbols" value={t.symbols ?? "outline"} options={SYMBOLS} onChange={(v) => set({ symbols: v === "outline" ? undefined : (v as Theme["symbols"]) })} />
          </Row>
          <Row label="Icon size">
            <MiniSeg label="Icon size" value={t.iconScale ?? "medium"} options={ICON_SIZES} onChange={(v) => set({ iconScale: v === "medium" ? undefined : (v as Theme["iconScale"]) })} />
          </Row>
          <Row label="Tab bar">
            <MiniSeg label="Tab bar" value={t.tabStyle ?? "own"} options={TAB_STYLES} onChange={(v) => set({ tabStyle: v === "own" ? undefined : (v as Theme["tabStyle"]) })} />
          </Row>
          <Row label="Motion">
            <MiniSeg label="Motion" value={t.motion ?? "smooth"} options={MOTIONS} onChange={(v) => set({ motion: v === "smooth" ? undefined : (v as Theme["motion"]) })} />
          </Row>
          <Row label="Entrance">
            <MiniSeg label="Entrance" value={t.entrance ?? "none"} options={ENTRANCES} onChange={(v) => set({ entrance: v === "none" ? undefined : (v as Theme["entrance"]) })} />
          </Row>
          <Row label="Mascot">
            <MiniSeg label="Mascot" value={t.mascot ?? "shown"} options={MASCOTS} onChange={(v) => set({ mascot: v === "shown" ? undefined : (v as Theme["mascot"]) })} />
          </Row>
        </div>
      </details>

    </div>
  );
});

function Section({ title, lock, children }: { title: string; lock?: ReactNode; children: ReactNode }) {
  return (
    <section className="spp-section">
      <div className="spp-style-head">
        <h2 className="spp-label">{title}</h2>
        {lock}
      </div>
      {children}
    </section>
  );
}

/** One setting: its name on the left, its control on the right. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="spp-style-row">
      <span className="spp-style-row-label">{label}</span>
      {children}
    </div>
  );
}

function MiniSeg({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="spp-seg spp-seg-fill spp-seg-sm" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} title={l}>{l}</button>
      ))}
    </div>
  );
}

/** A font as one menu, grouped by kind, beside an "Aa" drawn in it. Headings can follow the body. */
function FontSelect({ label, value, body, bodyOnly, onChange }: { label: string; value: string | null; body?: string; bodyOnly?: boolean; onChange: (id: string | null) => void }) {
  const current = fontById(value ?? body ?? "default");
  const pool = bodyOnly ? bodyFonts : fonts;
  const cats = FONT_CATEGORIES.filter((c) => pool.some((f) => f.category === c.id));
  const outside = value && !pool.some((f) => f.id === value) ? current : null;
  return (
    <span className="spp-font-select">
      <span className="spp-font-aa" style={{ fontFamily: current.css }} aria-hidden>Aa</span>
      <select className="spp-select spp-select-sm" value={value ?? SAME} onChange={(e) => onChange(e.target.value === SAME ? null : e.target.value)} aria-label={`${label} font`}>
        {!bodyOnly ? <option value={SAME}>Same as body</option> : null}
        {outside ? <option value={outside.id}>{outside.name}</option> : null}
        {cats.map((c) => (
          <optgroup key={c.id} label={c.label}>
            {pool.filter((f) => f.category === c.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </optgroup>
        ))}
      </select>
    </span>
  );
}
const SAME = "__same";
