import { STYLE_FIELDS, STYLE_OPTIONS, encodeStyle, looks, moods, themeFromLook, type StyleOptionKey } from "@swiftpieces/builder";
import { StudioFrame } from "./studio-frame";

const TILES = ["hero", "type", "palette", "track", "pay", "chart", "goal", "days"];

const label = (key: StyleOptionKey) => STYLE_FIELDS.find((f) => f.key === key)?.label ?? key[0].toUpperCase() + key.slice(1);

/**
 * The studio as the server draws it, while the live one loads: the same frame, grid and panel, the
 * page's title, and every setting with its choices written out (crawlers and no-JavaScript visitors
 * read what a style is made of). The tiles are quiet placeholders. Nothing here is interactive.
 */
export function StudioShell() {
  const code = encodeStyle(themeFromLook("pieces"));
  const groups: Array<[string, StyleOptionKey[]]> = [
    ["Character", ["density", "weight", "motion"]],
    ["Color", ["neutrals", "ground", "appearance", "contrast", "darkGround"]],
    ["Typography", ["textSize", "hierarchy", "headers", "numbers"]],
    ["Shape", ["corners", "cards", "buttons", "buttonSize", "lists"]],
    ["Feel", ["symbols", "iconScale", "tabStyle", "backdrop", "entrance", "width", "tracking", "mascot"]],
  ];
  return (
    <StudioFrame
      busy
      canvas={
        <div className="studio-grid size-full">
          {TILES.map((id) => (
            <div key={id} data-tile={id} className="min-h-0 animate-pulse rounded-[var(--radius-lg)] bg-white/[.04]" />
          ))}
        </div>
      }
      panel={
        <div className="studio-dark flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--studio-panel)] max-lg:h-[640px] lg:h-full">
          <div className="flex-none px-4 pt-4 pb-4">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Styles</h1>
            <p className="mt-0.5 text-[12px] text-muted">One style for every screen: color, type, shape and motion.</p>
            <div className="btn-solid mt-3 flex h-9 items-center justify-center rounded-[var(--radius)] text-[13px] font-semibold">Shuffle</div>
            <p className="mt-2 text-[11px] text-subtle">Moods: {moods.map((m) => m.name).join(", ")}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-4">
            <ShellRow name="Look" value={looks.map((l) => l.name).join(", ")} />
            {groups.map(([title, keys]) => (
              <div key={title}>
                <h2 className="mt-5 mb-2 text-[12px] font-semibold text-foreground">{title}</h2>
                {keys.map((k) => (
                  <ShellRow key={k} name={k === "density" ? "Spacing" : k === "weight" ? "Weight" : k === "corners" ? "Corners" : k === "cards" ? "Cards" : k === "appearance" ? "Appearance" : label(k)} value={(STYLE_OPTIONS[k] as Array<[string, string]>).map((o) => o[1]).join(", ")} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex-none border-t border-[var(--card-border)] p-3">
            <div className="flex h-9 items-center rounded-[var(--radius)] bg-[var(--studio-row)] px-3">
              <code className="truncate font-mono text-[11.5px] text-foreground">{code}</code>
            </div>
            <div className="btn-solid mt-1.5 flex h-9 items-center justify-center rounded-[var(--radius)] text-[12.5px] font-semibold">Open in the Playground</div>
          </div>
        </div>
      }
    />
  );
}

function ShellRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="mb-1.5 flex h-9 items-center justify-between gap-3 rounded-[var(--radius)] bg-[var(--studio-row)] px-3 text-[12.5px]">
      <span className="text-muted">{name}</span>
      <span className="truncate text-foreground/70">{value}</span>
    </div>
  );
}
