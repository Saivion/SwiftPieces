"use client";
// The studio panel's controls, compact enough that a whole style fits one column: a setting as one
// row (its name, its value, the native menu under it), a strip of colours, and a pad that sets
// spacing and weight together. Graphite: pills of the tray colour on the panel, in the site's own
// light or dark tokens.
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { FONT_CATEGORIES, bodyFonts, fontById, fonts, type Theme } from "@swiftpieces/builder";
import { cn } from "@/lib/cn";
import { field } from "./studio-frame";

const row = `ai-host relative flex h-9 items-center justify-between gap-3 rounded-full px-3.5 text-[13px] focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent ${field}`;

function Chevrons() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3 flex-none text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A heading between groups of rows. */
export function GroupLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mt-6 mb-2.5 flex items-center justify-between gap-3 px-1 first:mt-0">
      <h2 className="text-[13px] font-medium text-foreground">{children}</h2>
      {aside}
    </div>
  );
}

/**
 * One setting as one row: its name, its value, and the native menu that changes it. `setting` (its
 * Theme key) lets the panel tell the canvas which setting is pointed at.
 */
export function SelectRow({ setting, label, value, options, onChange }: { setting?: string; label: string; value: string; options: ReadonlyArray<readonly [string, string, ...unknown[]]>; onChange: (v: string) => void }) {
  const shown = options.find((o) => o[0] === value)?.[1] ?? value;
  return (
    <label className={row} data-setting={setting}>
      <span className="truncate text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-foreground">
        <span className="truncate">{shown}</span>
        <Chevrons />
      </span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0">
        {options.map((o) => (
          <option key={o[0]} value={o[0]}>
            {o[1]}
          </option>
        ))}
      </select>
    </label>
  );
}

const SAME = "__same";

/** A font row: the font's name in itself, the catalogue grouped by kind. Headings can follow the body. */
export function FontRow({ setting, label, value, body, bodyOnly, onChange }: { setting?: string; label: string; value: string | null; body?: string; bodyOnly?: boolean; onChange: (id: string | null) => void }) {
  const current = fontById(value ?? body ?? "default");
  const pool = bodyOnly ? bodyFonts : fonts;
  const kinds = FONT_CATEGORIES.filter((c) => pool.some((f) => f.category === c.id));
  return (
    <label className={row} data-setting={setting}>
      <span className="truncate text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-foreground">
        <span className="truncate" style={{ fontFamily: current.css }}>
          {value === null && !bodyOnly ? "Same as body" : current.name}
        </span>
        <Chevrons />
      </span>
      <select aria-label={`${label} font`} value={value ?? SAME} onChange={(e) => onChange(e.target.value === SAME ? null : e.target.value)} className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0">
        {!bodyOnly ? <option value={SAME}>Same as body</option> : null}
        {kinds.map((c) => (
          <optgroup key={c.id} label={c.label}>
            {pool.filter((f) => f.category === c.id).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export type Swatch = { key: string; color: string; label: string; on: boolean; pick: () => void };

/**
 * The colours as one strip, edge to edge: the picked one lifts out of it. The last cell is any
 * colour (the system picker), showing the custom colour once there is one.
 */
export function ColorStrip({ setting, swatches, custom, onCustom }: { setting?: string; swatches: Swatch[]; custom: string | null; onCustom: (hex: string) => void }) {
  return (
    <div className="flex items-center gap-1.5" data-setting={setting}>
      {/* isolate: the picked swatch's z-index lifts it above its neighbours only, never above the
          canvas that stays pinned over the scrolling settings on a phone. */}
      <div role="radiogroup" aria-label="Accent" className="isolate flex h-9 min-w-0 flex-1 items-stretch overflow-visible rounded-full">
        {swatches.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={s.on}
            aria-label={s.label}
            title={s.label}
            onClick={s.pick}
            className={cn(
              "relative min-w-0 flex-1 transition-[transform,box-shadow] duration-200 ease-[var(--ease-out)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-checked:z-10 aria-checked:scale-y-[1.22] aria-checked:scale-x-[1.35] aria-checked:rounded-full aria-checked:shadow-[0_0_0_2px_var(--surface-2),0_0_0_3.5px_var(--foreground)]",
              i === 0 && "rounded-l-full",
              i === swatches.length - 1 && "rounded-r-full",
            )}
            style={{ background: s.color }}
          />
        ))}
      </div>
      <label
        title={custom ? `Custom ${custom}` : "Any colour"}
        className={cn("relative grid size-9 flex-none cursor-pointer place-items-center rounded-full text-foreground focus-within:outline-2 focus-within:outline-accent", field, custom && "shadow-[0_0_0_2px_var(--surface-2),0_0_0_3.5px_var(--foreground)]")}
        style={custom ? { background: custom } : undefined}
      >
        {custom ? null : (
          <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
        )}
        <input type="color" value={(custom ?? "#ff0000").toLowerCase()} onChange={(e) => onCustom(e.target.value.toUpperCase())} aria-label="Any accent colour" className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

const WEIGHTS: Array<Theme["weight"]> = ["light", "regular", "medium", "bold", "heavy"];
const DENSITIES: Array<Theme["density"]> = ["airy", "roomy", "regular", "compact"];

/** How far the pad's dot stays from its edges, in pixels, so it never covers the axis words there. */
const INSET_X = 34;
const INSET_Y = 28;

/**
 * Character: spacing (Airy at the top, Compact at the bottom) and weight (Quiet on the left, Bold on
 * the right) on one pad, a faint mark at each of its twenty stops. Tap or drag anywhere to set both;
 * arrow keys move a step. Hairlines cross at the knob, and the axis words light up at their ends.
 */
export function CharacterPad({ setting, weight, density, onChange }: { setting?: string; weight: Theme["weight"]; density: Theme["density"]; onChange: (p: { weight: Theme["weight"]; density: Theme["density"] }) => void }) {
  const pad = useRef<HTMLDivElement>(null);
  const x = WEIGHTS.indexOf(weight);
  const y = DENSITIES.indexOf(density);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = pad.current!.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left - INSET_X) / (r.width - INSET_X * 2)));
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top - INSET_Y) / (r.height - INSET_Y * 2)));
    const w = WEIGHTS[Math.round(fx * (WEIGHTS.length - 1))];
    const d = DENSITIES[Math.round(fy * (DENSITIES.length - 1))];
    if (w !== weight || d !== density) onChange({ weight: w, density: d });
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const s = step[e.key];
    if (!s) return;
    e.preventDefault();
    const nx = Math.min(WEIGHTS.length - 1, Math.max(0, x + s[0]));
    const ny = Math.min(DENSITIES.length - 1, Math.max(0, y + s[1]));
    onChange({ weight: WEIGHTS[nx], density: DENSITIES[ny] });
  };
  const left = `calc(${INSET_X}px + (100% - ${INSET_X * 2}px) * ${x / (WEIGHTS.length - 1)})`;
  const top = `calc(${INSET_Y}px + (100% - ${INSET_Y * 2}px) * ${y / (DENSITIES.length - 1)})`;
  const move = "duration-300 ease-[var(--ease-spring)]";
  return (
    <div
      ref={pad}
      role="slider"
      tabIndex={0}
      data-setting={setting}
      aria-label="Character: spacing and weight"
      aria-valuetext={`${density} spacing, ${weight} weight`}
      onKeyDown={key}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        at(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && at(e)}
      className="relative h-[124px] cursor-crosshair touch-none overflow-hidden rounded-[22px] bg-surface select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
    >
      {WEIGHTS.flatMap((_, i) =>
        DENSITIES.map((_, j) => (
          <span
            key={`${i}-${j}`}
            aria-hidden
            className="absolute size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--line-strong)]"
            style={{ left: `calc(${INSET_X}px + (100% - ${INSET_X * 2}px) * ${i / (WEIGHTS.length - 1)})`, top: `calc(${INSET_Y}px + (100% - ${INSET_Y * 2}px) * ${j / (DENSITIES.length - 1)})` }}
          />
        )),
      )}
      <span aria-hidden className={`absolute inset-y-0 w-px -translate-x-1/2 bg-[var(--line)] transition-[left] ${move}`} style={{ left }} />
      <span aria-hidden className={`absolute inset-x-0 h-px -translate-y-1/2 bg-[var(--line)] transition-[top] ${move}`} style={{ top }} />
      <Axis on={y === 0} className="top-2 left-1/2 -translate-x-1/2">Airy</Axis>
      <Axis on={y === DENSITIES.length - 1} className="bottom-2 left-1/2 -translate-x-1/2">Compact</Axis>
      <Axis on={x === 0} className="top-1/2 left-2 -translate-y-1/2 rotate-180 [writing-mode:vertical-rl]">Quiet</Axis>
      <Axis on={x === WEIGHTS.length - 1} className="top-1/2 right-2 -translate-y-1/2 [writing-mode:vertical-rl]">Bold</Axis>
      <span aria-hidden className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_2px_8px_rgb(0_0_0/.35)] transition-[left,top] ${move}`} style={{ left, top }} />
    </div>
  );
}

function Axis({ on, className, children }: { on: boolean; className: string; children: ReactNode }) {
  return <span className={cn("pointer-events-none absolute text-[10.5px] leading-none font-medium transition-colors duration-300", on ? "text-foreground" : "text-subtle", className)}>{children}</span>;
}

/** A small toggle chip (a lock): a tray-colour pill, the ink pill while pressed. */
export function Chip({ pressed, onClick, title, children }: { pressed?: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className="ai-host inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-full bg-surface px-1.5 text-[11.5px] font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-pressed:bg-foreground aria-pressed:text-background"
    >
      {children}
    </button>
  );
}
