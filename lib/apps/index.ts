// The app library, joined up: each app's App Store facts (the developer's, labeled as such) with
// the SwiftPieces pattern that recreates one of its interactions (ours). Pure data, server-safe.
import { createCatalog, isCatalogKind, type CatalogEntry } from "@swiftpieces/builder";
import { patternsCatalogSource } from "@swiftpieces/builder/catalog";
import store from "./app-store.json";
import { LIBRARY } from "./library";

export const APPS_PATH = "/apps";

/** The patterns as a catalog, to resolve each app's recreation. */
const patternCatalog = createCatalog(patternsCatalogSource);

/** Facts from the App Store lookup API. Everything here belongs to the developer. */
export type AppStoreFacts = {
  trackId: number;
  name: string;
  developer: string;
  category: string;
  rating: number | null;
  ratingCount: number;
  price: string;
  icon: string;
  /** In App Store order, with each image's real pixel size (they come in several proportions). */
  screenshots: Array<{ url: string; width: number; height: number }>;
  url: string;
  released: string;
};

export type LibraryEntry = {
  slug: string;
  /** The short name used in titles and credits ("Lungy"). */
  name: string;
  store: AppStoreFacts;
  pattern: CatalogEntry;
  /** Screenshots we recreated (see library.ts), in the order to step through them. */
  screens: Array<{ shot: number; step: number; title: string }>;
};

const facts = store.apps as Record<string, AppStoreFacts>;
export const appStoreFetchedAt = store.fetchedAt;

/** The part of an App Store name before its tagline: "Lungy: Breathing & Anxiety" → "Lungy". */
export const shortName = (name: string) => name.split(/\s[:\-–—|]\s|:\s/)[0].trim();

function patternFor(key: string): CatalogEntry {
  const [kind, slug] = key.split("/");
  const entry = isCatalogKind(kind) ? patternCatalog.get(kind, slug) : undefined;
  if (!entry) throw new Error(`lib/apps/library.ts names a pattern that doesn't exist: ${key}`);
  return entry;
}

/** Every app with both halves present. An app missing from the App Store data is left out. */
export const apps: LibraryEntry[] = LIBRARY.filter((a) => facts[a.slug]).map((a) => ({ slug: a.slug, name: a.name ?? shortName(facts[a.slug].name), store: facts[a.slug], pattern: patternFor(a.pattern), screens: (a.screens ?? []).filter((x) => facts[a.slug].screenshots[x.shot]) }));

/**
 * The App Store screenshot shown as a screen's inspiration. Every screen gets one: the screenshot
 * it was recreated from when there is one, else one of the app's screenshots no screen claims
 * (handed out in step order), else one of the others, so no screen of the remix goes without.
 */
export function shotFor(a: Pick<LibraryEntry, "screens" | "store">, step: number): number | null {
  const count = a.store.screenshots.length;
  if (!count) return null;
  const mapped = a.screens.find((x) => x.step === step);
  if (mapped) return mapped.shot;
  const claimed = new Set(a.screens.map((x) => x.shot));
  const free = a.store.screenshots.map((_, i) => i).filter((i) => !claimed.has(i));
  const covered = new Set(a.screens.map((x) => x.step));
  let rank = 0;
  for (let k = 0; k < step; k++) if (!covered.has(k)) rank++;
  return free.length ? free[rank % free.length] : Math.max(0, step) % count;
}

export const appBySlug = (slug: string) => apps.find((a) => a.slug === slug);

/**
 * A Pro app: its remix opens for Pro accounts only. Its screens are Pro's (their build lives in the
 * Pro repo and reaches a Pro session through the Pro API); Free shows its entry, its App Store
 * screenshots and its screens blurred (public/app-remixes/locked).
 */
export const isProApp = (a: Pick<LibraryEntry, "pattern">) => a.pattern.availability === "pro";

/**
 * A Pro app's screen as Free shows it: blurred past reading (public/app-remixes/locked, made by
 * scripts/app-remixes/capture.ts --locked). Nothing sharp of a Pro remix is published.
 */
export const lockedStill = (slug: string, step: number) => `/app-remixes/locked/${slug}-${step}.webp`;

export const appPath = (a: Pick<LibraryEntry, "slug">) => `${APPS_PATH}/${a.slug}`;
/**
 * Where "Run in SwiftUI" goes: the app's Playground, opened at one of its App Store screenshots
 * when given (the screen we recreated from it, with it beside the phone).
 */
export const runPath = (a: Pick<LibraryEntry, "slug">, shot?: number) => `/playground/${a.slug}${shot !== undefined ? `?shot=${shot}` : ""}`;
/** An app's Playground opened at one screen of its remix, by step, whether or not a screenshot answers it. */
export const screenPath = (a: Pick<LibraryEntry, "slug">, step: number) => `/playground/${a.slug}?screen=${step}`;

/** App Store categories in use, most common first, with a URL-safe id. */
export const appCategories = (() => {
  const counts = new Map<string, number>();
  for (const a of apps) counts.set(a.store.category, (counts.get(a.store.category) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([name, count]) => ({ id: categoryId(name), name, count }));
})();

export function categoryId(name: string) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * An Apple CDN image at a given width. The lookup API returns fixed small sizes
 * (".../392x696bb.png"); the CDN serves any width from the same path.
 */
export function cdn(url: string, width: number, format: "webp" | "jpg" | "png" = "webp") {
  return url.replace(/\/[^/]+$/, `/${width}x0w.${format}`);
}

