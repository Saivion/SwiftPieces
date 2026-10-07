"use client";
// The studio's settings: one dark column beside the canvas. The style's name and Shuffle (in a mood,
// keeping what's locked) at the top, then every setting as one compact row, in the order that
// changes a style most: its look, its character (spacing and weight), motion, colour, type, shape
// and feel. The choices and their words are the Playground's Style tab's (core/style-options.ts).
// Where the style goes (its code, Swift, the Playground) stays pinned at the bottom. Pointing at a
// setting (or tabbing to it) tells the canvas, which lights up the tiles that setting changes.
import { useRef } from "react";
import {
  STYLE_FIELDS, STYLE_OPTIONS, STYLE_SECTIONS, accentRow, lookById, looks, moods, stylePatch, styleValue, type StyleOptionKey, type Theme,
} from "@swiftpieces/builder";
import { UI } from "@swiftpieces/builder/react";
import { CharacterPad, Chip, ColorStrip, FontRow, GroupLabel, SelectRow, type Swatch } from "./studio-controls";
import { StudioActions, type StyleApp } from "./studio-actions";
import { spotOf, type Spot } from "./follows";
import type { Studio } from "./studio-state";

/** A choice's word, as its menu shows it. */
const optionLabel = (key: StyleOptionKey, value: string) => STYLE_OPTIONS[key].find((o) => o[0] === value)?.[1] ?? value;

/** A setting's row label: the Style tab's word for it. */
const labelOf = (key: StyleOptionKey) => STYLE_FIELDS.find((f) => f.key === key)?.label ?? key[0].toUpperCase() + key.slice(1);

export function StudioPanel({ studio, apps, preferred, onNotice, onSpot }: { studio: Studio; apps: StyleApp[]; preferred: string | null; onNotice: (text: string) => void; onSpot: (spot: Spot | null) => void }) {
  const { theme: t, edit } = studio;
  // The setting under the pointer, or tabbed to (a mouse click's focus doesn't count, so a setting
  // just picked from its menu lets go of the canvas once the pointer leaves it).
  const pointed = useRef<string | null>(null);
  const point = (target: EventTarget | null) => {
    const key = target instanceof Element ? (target.closest("[data-setting]")?.getAttribute("data-setting") ?? null) : null;
    if (key === pointed.current) return;
    pointed.current = key;
    onSpot(key ? spotOf(key) : null);
  };
  const look = lookById(t.look);
  const accents = accentRow(t);
  const swatches: Swatch[] = [
    { key: "own", color: accents.own, label: `${look.name}'s own accent`, on: !t.accentHex && t.accent === -1, pick: () => edit({ accent: -1, accentHex: undefined }) },
    ...accents.tiles.map((c, i) => ({ key: `tile-${i}`, color: c, label: `${look.name} colour ${i + 1}`, on: !t.accentHex && t.accent === i, pick: () => edit({ accent: i, accentHex: undefined }) })),
    ...accents.spread.map((c) => ({ key: c, color: c, label: `Accent ${c}`, on: t.accentHex?.toUpperCase() === c, pick: () => edit({ accentHex: c }) })),
  ];
  const rows = (...keys: StyleOptionKey[]) =>
    keys.map((key) => <SelectRow key={key} setting={key} label={labelOf(key)} value={styleValue(t, key)} options={STYLE_OPTIONS[key]} onChange={(v) => edit(stylePatch(key, v))} />);

  return (
    <div className="studio-dark flex min-h-0 flex-col rounded-[var(--radius-lg)] bg-[var(--studio-panel)] shadow-[0_24px_60px_-30px_rgb(0_0_0/.8)] lg:h-full lg:overflow-hidden">
      <Head studio={studio} />
      <div
        className="min-h-0 flex-1 px-4 pb-4 lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-width:thin]"
        onPointerOver={(e) => e.pointerType === "mouse" && point(e.target)}
        onPointerLeave={() => point(null)}
        onFocus={(e) => e.target.matches(":focus-visible") && point(e.target)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && point(null)}
      >
        <div className="flex flex-col gap-1.5">
          <SelectRow setting="look" label="Look" value={t.look} options={looks.map((l) => [l.id, l.name] as const)} onChange={(id) => edit({ look: id, ...(t.accent >= lookById(id).light.tiles.length ? { accent: -1 } : {}) })} />
        </div>
        <GroupLabel aside={<span className="text-[10.5px] text-subtle">{optionLabel("density", t.density)} · {optionLabel("weight", t.weight)}</span>}>Character</GroupLabel>
        <CharacterPad setting="weight" weight={t.weight} density={t.density} onChange={(p) => edit(p)} />
        <div className="mt-1.5 flex flex-col gap-1.5">{rows("motion")}</div>
        <GroupLabel aside={<span className="font-mono text-[10.5px] text-subtle">{(t.accentHex ?? accents.own).toUpperCase()}</span>}>Color</GroupLabel>
        <ColorStrip setting="accent" swatches={swatches} custom={accents.custom} onCustom={(hex) => edit({ accentHex: hex })} />
        <div className="mt-1.5 flex flex-col gap-1.5">
          {rows("neutrals", "ground")}
          <SelectRow setting="appearance" label="Appearance" value={t.appearance} options={STYLE_OPTIONS.appearance} onChange={(v) => edit({ appearance: v as Theme["appearance"] })} />
          {rows("contrast", "darkGround")}
        </div>
        <GroupLabel>Typography</GroupLabel>
        <div className="flex flex-col gap-1.5">
          <FontRow setting="headingFont" label="Headings" value={t.headingFont ?? null} body={t.font} onChange={(id) => edit({ headingFont: id === null || id === t.font ? undefined : id })} />
          <FontRow setting="font" label="Body" value={t.font} bodyOnly onChange={(id) => edit({ font: id ?? "default", ...(t.headingFont === id ? { headingFont: undefined } : {}) })} />
          {rows("textSize", "hierarchy", "headers", "numbers")}
        </div>
        <GroupLabel>Shape</GroupLabel>
        <div className="flex flex-col gap-1.5">
          <SelectRow setting="corners" label="Corners" value={t.corners} options={STYLE_OPTIONS.corners} onChange={(v) => edit({ corners: v as Theme["corners"] })} />
          <SelectRow setting="cards" label="Cards" value={styleValue(t, "cards")} options={STYLE_OPTIONS.cards} onChange={(v) => edit(stylePatch("cards", v))} />
          {rows("buttons", "buttonSize", "lists")}
        </div>
        <GroupLabel>Feel</GroupLabel>
        <div className="flex flex-col gap-1.5">{rows("symbols", "iconScale", "tabStyle", "backdrop", "entrance", "width", "tracking", "mascot")}</div>
      </div>
      <StudioActions studio={studio} apps={apps} preferred={preferred} onNotice={onNotice} />
    </div>
  );
}

/** The page's title, the style's name, a way back through what was made, and Shuffle. */
function Head({ studio }: { studio: Studio }) {
  const t = studio.theme;
  return (
    <div className="flex-none px-4 pt-4 pb-4">
      <div className="flex items-center gap-1">
        <h1 className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">Styles</h1>
        <IconButton label="Previous style" onClick={studio.back} disabled={!studio.canBack}>
          <UI name="left" size={14} />
        </IconButton>
        <IconButton label="Next style" onClick={studio.forward} disabled={!studio.canForward}>
          <UI name="right" size={14} />
        </IconButton>
      </div>
      <p className="mt-0.5 truncate text-[12px] text-muted">
        <span key={t.name ?? t.look} className="text-foreground">{t.name ?? lookById(t.look).name}</span>
        {studio.mood ? ` · ${studio.mood.name} mood` : t.name ? "" : " · your style"}
      </p>
      <div className="mt-3 flex gap-1.5">
        <button type="button" onClick={() => studio.shuffle()} title="A new style (S)" className="btn-solid ai-host flex h-9 flex-1 items-center justify-center gap-2 rounded-[var(--radius)] text-[13px] font-semibold">
          <UI name="shuffle" size={14} />
          Shuffle
          <kbd className="rounded-[var(--radius-sm)] bg-black/15 px-1.5 py-px text-[10px] font-semibold">S</kbd>
        </button>
        <div className="w-[118px] flex-none">
          <SelectRow label="Mood" value={studio.pick} options={[["any", "Any"], ...moods.map((m) => [m.id, m.name] as const)]} onChange={studio.setPick} />
        </div>
      </div>
      <div className="mt-1.5 flex gap-1" role="group" aria-label="Keep while shuffling">
        {STYLE_SECTIONS.map((s) => (
          <Chip key={s.id} pressed={studio.locks.has(s.id)} onClick={() => studio.toggleLock(s.id)} title={studio.locks.has(s.id) ? `${s.label} stays as it is` : `Keep ${s.label.toLowerCase()} when shuffling`}>
            <UI name={studio.locks.has(s.id) ? "lock" : "lockOpen"} size={10} />
            {s.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function IconButton({ label, onClick, disabled, type = "button", children }: { label: string; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; children: React.ReactNode }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="ai-host grid size-8 flex-none place-items-center rounded-[var(--radius)] text-muted transition-colors hover:bg-white/[.07] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
