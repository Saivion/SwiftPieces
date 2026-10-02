// The Playground's Apps tab: every app in the library, the free ones first and the Pro ones below,
// with the open one marked. Picking one opens it in place (the Playground's navigate: the address
// changes, the page doesn't reload); a Pro app opens locked, its screens blurred, for anyone
// without Pro. The server-rendered shell draws the same list as plain links, so nothing moves when
// the Playground takes over (components/playground/playground-app.tsx).
"use client";
import type { MouseEvent } from "react";
import { ProCrown, UI, usePlay, usePlayground } from "@swiftpieces/builder/react";
import { apps, cdn, isProApp, type LibraryEntry } from "@/lib/apps";
import type { ProSession } from "@/lib/pro-bridge";
import { cn } from "@/lib/cn";

export type SidebarItem = { key: string; title: string; step: number; stepTitle: string; shot: number | null };

/**
 * An app's screens, by App Store screenshot: the screenshots we remixed, then the remix's own screens
 * that no screenshot maps to (a sheet, a detail). `?shot=` and `?screen=` open the app at one.
 */
export function sidebarItems(a: LibraryEntry, stepTitles: string[]): SidebarItem[] {
  const mapped = a.screens.map((s) => ({ key: `shot-${s.shot}`, title: s.title, step: s.step, stepTitle: stepTitles[s.step] ?? "", shot: s.shot }));
  const covered = new Set(a.screens.map((s) => s.step));
  const rest = stepTitles.flatMap((t, i) => (covered.has(i) ? [] : [{ key: `step-${i}`, title: t, step: i, stepTitle: "", shot: null }]));
  return [...mapped, ...rest];
}

const freeApps = apps.filter((a) => !isProApp(a));
const proApps = apps.filter(isProApp);

/**
 * The list itself: free apps, then Pro apps. `current` is the open app; `locked` whether Pro apps
 * are locked for this visitor (unknown while the plan check runs: no locks drawn yet). `onPick`
 * opens an app in place; without it (the server's shell) the rows are plain links.
 */
export function AppsList({ current, locked, onPick }: { current: LibraryEntry | null; locked: boolean | null; onPick?: (a: LibraryEntry) => void }) {
  const row = (a: LibraryEntry) => {
    const here = current?.slug === a.slug;
    const screens = a.pattern.steps?.length ?? 0;
    const lock = isProApp(a) && locked === true;
    const click = (e: MouseEvent<HTMLAnchorElement>) => {
      if (!onPick || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (!here) onPick(a);
    };
    return (
      <li key={a.slug}>
        <a href={`/playground/${a.slug}`} onClick={click} aria-current={here ? "page" : undefined} className={cn("spa-app", here && "is-here")} title={lock ? `${a.pattern.title}: part of Pro` : a.pattern.title}>
          <img src={cdn(a.store.icon, 64)} alt="" width={28} height={28} loading="lazy" className="spa-icon" />
          <span className="spa-text">
            <span className="spa-name">{a.name}</span>
            <span className="spa-sub">{a.pattern.title}</span>
          </span>
          {lock ? (
            <span className="spa-lock" aria-label="Locked: part of Pro">
              <UI name="lock" size={12} />
            </span>
          ) : (
            <span className="spa-count" aria-label={`${screens} screens`}>
              {screens}
            </span>
          )}
        </a>
      </li>
    );
  };
  return (
    <nav aria-label="Apps" className="spa">
      <section className="spa-group">
        <h2 className="spa-head">
          Free <span className="spa-head-n">{freeApps.length}</span>
        </h2>
        <ul>{freeApps.map(row)}</ul>
      </section>
      <section className="spa-group">
        <h2 className="spa-head">
          <ProTag />
          <span className="spa-head-n">{proApps.length} apps</span>
        </h2>
        <ul>{proApps.map(row)}</ul>
      </section>
    </nav>
  );
}

/** Inside the running Playground: the list, following the open entry, opening apps in place. */
export function AppsSidebar({ session }: { session: ProSession }) {
  const { store, navigate } = usePlayground();
  const entry = usePlay(store, (s) => s.entry);
  const current = entry ? (apps.find((a) => a.pattern.kind === entry.kind && a.pattern.slug === entry.slug) ?? null) : null;
  return (
    <AppsList
      current={current}
      locked={session === "checking" ? null : session !== "pro"}
      onPick={(a) => {
        navigate(a.pattern.kind, a.pattern.slug);
        // On a phone the list is a sheet over the stage: close it to show the app.
        store.setDrawer(null);
      }}
    />
  );
}

/** The Pro tag: the Pro apps' heading, and a Pro app's badge. */
export function ProTag() {
  return (
    <span className="spp-pro-tag">
      <ProCrown size={9} />
      Pro
    </span>
  );
}

/**
 * The open app, centered above its screens on the stage (the Playground's stageBadge): its icon, its
 * name and, for a Pro app, the Pro tag.
 */
export function AppBadge({ app: a }: { app: LibraryEntry }) {
  return (
    <span className="spa-badge">
      <img src={cdn(a.store.icon, 64)} alt="" width={22} height={22} className="spa-badge-icon" />
      <span className="spa-badge-name">{a.name}</span>
      <span className="spa-badge-sub">{a.pattern.title}</span>
      {isProApp(a) ? <ProTag /> : null}
    </span>
  );
}

/** The bottom of the Apps tab: the open app's fine print. */
export function AppSidebarFooter({ app: a }: { app: LibraryEntry }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--docs-line)] px-3.5 pt-3.5 pb-5">
      <p className="text-[11px] leading-relaxed text-subtle">
        An original Swift Pieces remix inspired by {a.name}. Screenshots © {a.store.developer}, for reference only; not affiliated.{" "}
        <a href="/terms#recreations" className="text-muted underline underline-offset-2">Terms</a>
      </p>
    </div>
  );
}
