// The free Playground catalog. Entry metadata lives here (light: lists, search, SEO, the sitemap);
// each kind's builds live in their own module, loaded the first time an entry of that kind opens.
import type { CatalogBuilder, CatalogEntry, CatalogKind, CatalogSource } from "../../core/catalog.js";
import { entries } from "./entries.js";
import { recreationBuilds, recreationEntries } from "./recreations/index.js";

export { entries as freeCatalogEntries };

const modules: Record<CatalogKind, () => Promise<{ builds: Record<string, CatalogBuilder> }>> = {
  screens: () => import("./screens.js"),
  flows: () => import("./flows.js"),
  elements: () => import("./elements.js"),
  interactions: () => import("./interactions.js"),
};

export const freeCatalogSource: CatalogSource = {
  entries,
  async load(entry: CatalogEntry) {
    const mod = await modules[entry.kind]();
    return mod.builds[entry.slug] ?? null;
  },
};

/** The app library's recreations, one per app (recreations/), free and Pro. */
export const patternEntries = recreationEntries;
export { FREE_RECREATIONS } from "./recreations/index.js";

/**
 * The shorthand builds are written in (kit.ts), for builds kept outside this package: the Pro apps'
 * live in the Pro repo and are written exactly like the free ones here.
 */
export { app, body, caption, col, flex, footnote, group, heading, headline, nd, row, section, single, space, stat, title, type Links, type ScreenSpec } from "./kit.js";

/**
 * The pattern recreations: an original interactive recreation per app in the sites' app library,
 * with their teardown notes attached. Its own source, so a host can list them without the rest of
 * the catalog. A free app's build loads the first time it opens; a Pro app (availability "pro") has
 * no build here, so a host that can open it adds a source of its own for it (Free: from the Pro API).
 */
export const patternsCatalogSource: CatalogSource = {
  entries: recreationEntries,
  async load(entry: CatalogEntry) {
    const load = recreationBuilds[entry.slug];
    return load ? (await load()).build : null;
  },
};
