import Link from "next/link";
import { CornerTicks } from "@/components/sections/feature-row";
import { apps, cdn, isProApp, screenPath } from "@/lib/apps";
import { SCREEN_KIND_INFO, SCREEN_KINDS, type ScreenKind } from "@/lib/apps/screen-kinds";
import { SCREEN_TAGS } from "@/lib/apps/screen-tags";
import { LockGlyph } from "./pro-chip";
import { ProSwap } from "./pro-swap";

/**
 * Browse by screen: every remixed screen, grouped by what kind of screen it is (lib/apps/screen-kinds.ts),
 * so people looking for "a calendar" or "a detail screen" find every take on it across the apps. Each
 * chip opens the Playground at that screen; a Pro app's carry a lock (they open with Pro). Drawn in
 * the same framed rows as the app list above it.
 */
/** The UI words in a screen's tags worth naming under a group: what its screens are built from. */
const UI = new Set(["chart", "tabs", "sheet", "list", "grid", "ring", "rings", "slider", "picker", "timer", "map", "cards", "carousel", "keypad", "form", "toggles", "stepper", "scrubber", "timeline", "feed", "counter", "animation", "pager", "heatmap", "bars", "tiles", "covers", "checklist", "chat", "flip card", "countdown", "gauge", "camera"]);

type Screen = { app: (typeof apps)[number]; step: number; title: string };

function screensByKind() {
  const groups = new Map<ScreenKind, Screen[]>();
  for (const app of apps) {
    const steps = app.pattern.steps ?? [];
    const kinds = SCREEN_KINDS[app.slug];
    if (!kinds || kinds.length !== steps.length) throw new Error(`lib/apps/screen-kinds.ts: ${app.slug} lists ${kinds?.length ?? 0} screens, its remix has ${steps.length}`);
    steps.forEach((s, step) => groups.set(kinds[step], [...(groups.get(kinds[step]) ?? []), { app, step, title: s.title }]));
  }
  return (Object.keys(SCREEN_KIND_INFO) as ScreenKind[]).flatMap((kind) => {
    const list = groups.get(kind);
    if (!list) return [];
    const counts = new Map<string, number>();
    for (const s of list) for (const t of SCREEN_TAGS[s.app.slug]?.[s.step] ?? []) if (UI.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    const ui = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 3).map(([t]) => t);
    return [{ kind, ...SCREEN_KIND_INFO[kind], list, ui }];
  });
}

export function ScreenDirectory() {
  const rows = screensByKind();
  return (
    <section aria-labelledby="screens-title" className="mt-24 scroll-mt-24 sm:mt-32">
      <h2 id="screens-title" className="text-[20px] font-semibold text-foreground">Browse by screen</h2>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">Every remixed screen by what kind of screen it is, across all the apps. Open any of them in the Playground; the ones with a lock open with Pro.</p>
      <ul className="mt-8">
        {rows.map((r, i) => (
          <li key={r.kind} className="frame-cell [--grid-line:var(--card-border)]">
            <CornerTicks corners={i === 0 ? ["tl", "tr", "bl", "br"] : ["bl", "br"]} />
            <div className="grid gap-4 p-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:p-6">
              <div>
                <p className="text-[13px] font-medium text-foreground">
                  {r.title} <span className="ml-1 text-[11px] font-normal text-subtle tabular-nums">{r.list.length}</span>
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{r.about}</p>
                {r.ui.length ? <code className="mt-2 block text-[11px] text-subtle">{r.ui.join(" · ")}</code> : null}
              </div>
              <ul className="flex flex-wrap content-start gap-2">
                {r.list.map((s) => (
                  <li key={`${s.app.slug}-${s.step}`}>
                    <Link href={screenPath(s.app, s.step)} className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--card-border)] py-1 pr-3 pl-1 text-[12px] text-foreground transition-colors hover:border-[var(--card-border-hover)]">
                      <img src={cdn(s.app.store.icon, 64)} alt="" width={22} height={22} loading="lazy" className="size-[22px] rounded-full" />
                      <span className="font-medium">{s.title}</span>
                      <span className="text-muted">· {s.app.name}</span>
                      {isProApp(s.app) ? (
                        <ProSwap pro={null}>
                          <LockGlyph className="text-subtle" />
                          <span className="sr-only">(Pro)</span>
                        </ProSwap>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
