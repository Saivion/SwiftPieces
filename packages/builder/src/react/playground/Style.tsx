"use client";
// The Style tab: one style for every screen, whichever app it came from, and everything in it is
// something the exported SwiftUI sets too. Shuffle makes a new, coherent style each time (a mood's
// rules over colour, type, shape and feel; core/shuffle.ts), keeps what is locked, remembers where it
// has been, and names what it makes. A style travels as a short code. Its choices, labels and
// presets are core/style-options.ts, shared with the host's Styles page.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FONT_CATEGORIES, bodyFonts, fontById, fontIds, fonts, webFontsHref } from "../../core/fonts.js";
import { lookById, themeFromLook } from "../../core/looks.js";
import type { Theme } from "../../core/schema.js";
import { STYLE_SECTIONS, decodeStyle, encodeStyle, moods, newSeed, shuffleTheme, styleSpace, type StyleSection } from "../../core/shuffle.js";
import { CORNER_PX, STYLE_FIELDS, STYLE_OPTIONS, STYLE_PRESETS, WEIGHT_CSS, accentRow, editTheme, presetColors, presetSelected, stylePatch, styleValue, type StyleGroup } from "../../core/style-options.js";
import { UI } from "../icons.js";
import { usePlayground } from "./context.js";
import { usePlay } from "./store.js";
import { loadFontsHref } from "./style-fonts.js";

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


/** A big count, written the way people say it ("297 trillion"). */
function spoken(n: number): string {
  const units: Array<[number, string]> = [[1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"], [1e6, "million"]];
  const hit = units.find(([u]) => n >= u);
  return hit ? `${Math.floor(n / hit[0])} ${hit[1]}` : n.toLocaleString("en-US");
}

type History = { list: Theme[]; at: number };

export const StylePanel = memo(function StylePanel() {
  const { store, host } = usePlayground();
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
  // Each control changes the style as it is now (not as it was when this panel last drew). A hand
  // edit drops the shuffled name, and a colour setting drops a screenshot's exact colours.
  const set = useCallback((p: Partial<Theme>) => store.setTheme(editTheme(tRef.current, p)), [store]);

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
  const { tiles: ownTiles, spread: extraAccents, custom } = accentRow(t);
  // The settings drawn as a row of choices, for one section.
  const rows = (group: StyleGroup) =>
    STYLE_FIELDS.filter((f) => f.group === group).map((f) => (
      <Row key={f.key} label={f.label}>
        <MiniSeg label={f.aria} value={styleValue(t, f.key)} options={STYLE_OPTIONS[f.key]} onChange={(v) => set(stylePatch(f.key, v))} />
      </Row>
    ));
  const studio = host.links.styles?.(code) ?? null;

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
              <input name="code" className="spp-code-input" placeholder="SP2-…" onKeyDown={(e) => e.key === "Escape" && setPasting(false)} autoFocus spellCheck={false} autoComplete="off" aria-label="Style code" />
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
              {/* The host's Styles page, on this style: a bigger room to make one in, then back here by code. */}
              {studio ? (
                <a className="spp-icon-btn spp-icon-btn-sm" href={studio} aria-label="Open this style in Styles" title="Open this style in Styles">
                  <UI name="palette" size={12} />
                </a>
              ) : null}
            </>
          )}
        </div>
        </div>
      </div>

      <Section title="Presets">
        <div className="spp-looks" role="radiogroup" aria-label="Preset">
          {STYLE_PRESETS.map((pr) => (
            // SwiftPieces shows its own palette and is on for the house look (light or dark either
            // way); the others show the colours they set and are on while they keep their name.
            <button key={pr.id} type="button" role="radio" aria-checked={presetSelected(pr, theme)} className="spp-look" onClick={() => store.setTheme(pr.theme())}>
              <PresetPreview theme={pr.theme()} colors={presetColors(pr)} />
              <span>{pr.label}</span>
            </button>
          ))}
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
        {rows("color")}
      </section>

      <section className="spp-section spp-style-rows">
        <h2 className="spp-label">Type</h2>
        <Row label="Headings">
          <FontSelect label="Headings" value={t.headingFont ?? null} body={t.font} onChange={(id) => set({ headingFont: id === null || id === t.font ? undefined : id })} />
        </Row>
        <Row label="Body">
          <FontSelect label="Body" value={t.font} bodyOnly onChange={(id) => set({ font: id ?? "default", ...(t.headingFont === id ? { headingFont: undefined } : {}) })} />
        </Row>
        {rows("type")}
        <Row label="Weight">
          <div className="spp-seg spp-seg-fill spp-seg-sm" role="radiogroup" aria-label="Weight">
            {STYLE_OPTIONS.weight.map(([v, l]) => (
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
            {STYLE_OPTIONS.corners.map(([v, label, r]) => (
              <button key={v} type="button" role="radio" aria-checked={t.corners === v} onClick={() => set({ corners: v })} title={label} aria-label={label}>
                <span className="spp-corner-sample ai ai-pop" style={{ borderTopLeftRadius: r * 0.7 }} aria-hidden />
              </button>
            ))}
          </div>
        </Row>
        <Row label="Cards">
          <div className="spp-seg spp-seg-fill spp-seg-sm" role="radiogroup" aria-label="Cards">
            {STYLE_OPTIONS.cards.map(([v, label]) => (
              <button key={v} type="button" role="radio" aria-checked={(t.cards ?? "flat") === v} data-card={v} onClick={() => set({ cards: v === "flat" ? undefined : v })} title={label} aria-label={label}>
                <span className="spp-card-sample ai ai-pop" aria-hidden />
              </button>
            ))}
          </div>
        </Row>
        {rows("shape")}
      </section>

      <details className="spp-style-more">
        <summary>
          <UI name="right" size={12} />
          More
          <span>Backdrop, letters, icons, tab bar, motion</span>
        </summary>
        <div className="spp-style-rows">{rows("more")}</div>
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
