import { STYLE_FIELDS, STYLE_OPTIONS, encodeStyle, looks, moods, themeFromLook, type StyleOptionKey } from "@swiftpieces/builder";
import { StudioFrame, panelSurface } from "./studio-frame";
import { cn } from "@/lib/cn";

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
            <div key={id} data-tile={id} className="min-h-0 animate-pulse rounded-[22px] bg-foreground/[.04]" />
          ))}
        </div>
      }
      panel={
        <div className={cn("flex min-h-0 flex-col overflow-hidden max-lg:h-[640px] lg:h-full", panelSurface)}>
          <div className="flex-none px-4 pt-[18px] pb-4">
            <h1 className="pl-1 text-[24px] leading-none font-normal tracking-[-0.03em]">Styles</h1>
            <p className="mt-1.5 pl-1 text-[13px] text-muted">One style for every screen: color, type, shape and motion.</p>
            <div className="btn-solid mt-3 flex h-9 items-center justify-center rounded-full text-[13.5px] font-semibold">Shuffle</div>
            <p className="mt-2 pl-1 text-[11.5px] text-subtle">Moods: {moods.map((m) => m.name).join(", ")}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-4">
            <ShellRow name="Look" value={looks.map((l) => l.name).join(", ")} />
            {groups.map(([title, keys]) => (
              <div key={title}>
                <h2 className="mt-6 mb-2.5 px-1 text-[13px] font-medium text-foreground">{title}</h2>
                {keys.map((k) => (
                  <ShellRow key={k} name={k === "density" ? "Spacing" : k === "weight" ? "Weight" : k === "corners" ? "Corners" : k === "cards" ? "Cards" : k === "appearance" ? "Appearance" : label(k)} value={(STYLE_OPTIONS[k] as Array<[string, string]>).map((o) => o[1]).join(", ")} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex-none border-t border-[var(--line)] p-3">
            <div className="flex h-9 items-center rounded-full bg-surface px-3.5">
              <code className="truncate font-mono text-[11.5px] text-foreground">{code}</code>
            </div>
            <div className="btn-solid mt-1.5 flex h-9 items-center justify-center rounded-full text-[12.5px] font-semibold">Open in the Playground</div>
          </div>
        </div>
      }
    />
  );
}

function ShellRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="mb-1.5 flex h-9 items-center justify-between gap-3 rounded-full bg-surface px-3.5 text-[13px]">
      <span className="text-muted">{name}</span>
      <span className="truncate text-foreground/70">{value}</span>
    </div>
  );
}
