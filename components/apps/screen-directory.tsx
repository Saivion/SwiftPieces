import Link from "next/link";
import { sectionBody, sectionTitle } from "@/components/sections/feature-row";
import { apps, cdn, isProApp, screenPath } from "@/lib/apps";
import { SCREEN_KIND_INFO, SCREEN_KINDS, type ScreenKind } from "@/lib/apps/screen-kinds";
import { SCREEN_TAGS } from "@/lib/apps/screen-tags";
import { LockGlyph } from "./pro-chip";
import { ProSwap } from "./pro-swap";

/**
 * Browse by screen: every remixed screen, grouped by what kind of screen it is (lib/apps/screen-kinds.ts),
 * so people looking for "a calendar" or "a detail screen" find every take on it across the apps. Each
 * chip opens the Playground at that screen; a Pro app's carry a lock (they open with Pro). Drawn in
 * tiles on the tray colour, the screens as pills on the panel colour.
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
    <section aria-labelledby="screens-title" className="mt-24 scroll-mt-24 sm:mt-[136px]">
      <h2 id="screens-title" className={sectionTitle}>Browse by screen</h2>
      <p className={`mt-4 max-w-[560px] ${sectionBody}`}>Every remixed screen by what kind of screen it is, across all the apps. Open any of them in the Playground; the ones with a lock open with Pro.</p>
      <ul className="mt-9 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.kind} className="grid gap-4 rounded-[22px] bg-surface p-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:p-6">
            <div>
              <p className="flex items-center justify-between gap-3 text-[16px] font-medium tracking-[-0.01em] text-foreground lg:justify-start">
                {r.title} <span className="text-[13px] font-medium text-subtle tabular-nums">{r.list.length}</span>
              </p>
              <p className="mt-1.5 text-[13.5px] leading-[21px] text-pretty text-muted">{r.about}</p>
              {r.ui.length ? <p className="mt-2.5 text-[12.5px] text-subtle">{r.ui.join(" · ")}</p> : null}
            </div>
            <ul className="flex flex-wrap content-start gap-1.5">
              {r.list.map((s) => (
                <li key={`${s.app.slug}-${s.step}`}>
                  <Link href={screenPath(s.app, s.step)} className="inline-flex h-[34px] items-center gap-2 rounded-full border border-transparent bg-surface-2 py-1 pr-3.5 pl-1.5 text-[13px] text-foreground transition-colors duration-200 hover:border-[var(--line-strong)] hover:bg-surface-3">
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
          </li>
        ))}
      </ul>
    </section>
  );
}
