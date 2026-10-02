// The Free Playground: where an app's recreated screens open. One page per app in the library
// (/playground/lungy), running that app's recreation, with the App Store screenshots it answers
// beside it. There is no catalog to browse here: people arrive from an app (/apps/lungy). Three apps
// are free; a Pro app's page shows its screens blurred until a Pro account opens it (lib/pro-apps.ts).
import { createCatalog, type CatalogEntry } from "@swiftpieces/builder";
import { patternsCatalogSource } from "@swiftpieces/builder/catalog";
import { apps, isProApp, runPath, type LibraryEntry } from "@/lib/apps";

export const PLAYGROUND_PATH = "/playground";

/**
 * What the Free Playground can open on the server: the app library's recreations. Only the free
 * apps build here; a Pro app's build comes from the Pro API, in the browser of a Pro account.
 */
export const playgroundCatalog = createCatalog(patternsCatalogSource);

/** An app's Playground, optionally opened at one of its App Store screenshots (`?shot=`). */
export const playgroundPath = runPath;

/** An app's Playground page title (the site's template adds " — Swift Pieces"). */
export const playgroundTitle = (a: LibraryEntry) => `${a.pattern.title}: a SwiftUI Remix to Try and Build (Inspired by ${a.name})`;

/** The app an entry recreates, if any. */
export const appForEntry = (entry: Pick<CatalogEntry, "kind" | "slug"> | null | undefined): LibraryEntry | null =>
  entry ? (apps.find((a) => a.pattern.kind === entry.kind && a.pattern.slug === entry.slug) ?? null) : null;

/** Where a saved remix opens, from the catalog entry it was made from: its app's playground. Null when the entry is no longer here. */
export function savedRemixPath(project: { entry?: unknown }): string | null {
  const entry = typeof project.entry === "string" ? project.entry : "";
  const app = apps.find((a) => `${a.pattern.kind}/${a.pattern.slug}` === entry);
  return app ? playgroundPath(app) : null;
}

/**
 * Where a component page's "Try it in the Playground" goes: the first free app whose recreation uses
 * the component, with it selected; else the first Pro app that does (`pro`: it opens for Pro
 * accounts). Null when none does.
 */
export function playgroundComponentHref(componentId: string | null): { href: string; pro: boolean } | null {
  if (!componentId) return null;
  const using = apps.filter((x) => x.pattern.components?.includes(componentId));
  const a = using.find((x) => !isProApp(x)) ?? using[0];
  return a ? { href: `${playgroundPath(a)}?component=${encodeURIComponent(componentId)}`, pro: isProApp(a) } : null;
}
