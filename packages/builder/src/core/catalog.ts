// The Playground catalog: everything someone can explore, as plain data. Four kinds share one
// shape. A screen, a flow, a UI element and an interaction are each an entry (light metadata that
// lists, search, SEO and the sitemap read) plus a build (the project the device runs), loaded only
// when the entry is opened. Free and Pro pass their own sources; the runtime never knows which.
import type { Availability, BuilderLimits, Project, Theme } from "./schema.js";
import type { InteractionId } from "./interactions.js";
import type { ComponentRegistry } from "./registry.js";
import { validateProject } from "./validate.js";

export type CatalogKind = "screens" | "flows" | "elements" | "interactions";

export const CATALOG_KINDS: Array<{ id: CatalogKind; label: string; singular: string; blurb: string }> = [
  { id: "screens", label: "Screens", singular: "Screen", blurb: "Whole iPhone screens you can use, take apart and remix." },
  { id: "flows", label: "Flows", singular: "Flow", blurb: "Screens linked into real journeys. Play them start to finish." },
  { id: "elements", label: "UI Elements", singular: "UI Element", blurb: "Buttons, cards, inputs and controls, every variant live." },
  { id: "interactions", label: "Interactions", singular: "Interaction", blurb: "Swipe, hold, drag, spring. Feel how native UI behaves." },
];

export const isCatalogKind = (v: unknown): v is CatalogKind => CATALOG_KINDS.some((k) => k.id === v);

/** How one flow step is reached, which is also the SwiftUI that connects it. */
export type StepTransition = "start" | "push" | "sheet" | "tab" | "replace";

export type CatalogEntry = {
  kind: CatalogKind;
  /** URL segment, unique within its kind. */
  slug: string;
  title: string;
  /** Group within its kind ("Account", "Commerce", "Buttons"…). */
  category: string;
  /** One line for lists and cards. */
  summary: string;
  /** Two or three sentences: the meta description and the About panel. Real content, never filler. */
  description: string;
  availability: Availability;
  /** What to try, in order. The preview teaches by being used, so these read as instructions. */
  try: string[];
  interactions: InteractionId[];
  /** Components featured, by definition id. The first is selected when an element or interaction opens. */
  components?: string[];
  /**
   * What makes it work, per step (one list for a single screen): short teardown notes a designer
   * would point at, shown beside the running screen.
   */
  moves?: string[][];
  /** Flow steps, one per screen in project order. */
  steps?: Array<{ title: string; transition: StepTransition; note?: string }>;
  /** Search phrases this entry answers ("swiftui paywall"). */
  keywords?: string[];
  /** A locked entry (Free's view of Pro): where it opens instead. Such entries have no build here. */
  href?: string;
  /** Marks an entry worth leading with. */
  featured?: boolean;
};

/** What an entry builds: a small project the device runs, the inspector reads and the export writes. */
export type CatalogBuild = Pick<Project, "name" | "screens" | "shell"> & { theme?: Theme; tabBar?: Project["tabBar"] };
export type CatalogBuilder = (newId: () => string) => CatalogBuild;

export type CatalogSource = {
  entries: CatalogEntry[];
  /** Resolves an entry's builder, loading its content chunk on first use. Null when it has none here. */
  load(entry: CatalogEntry): Promise<CatalogBuilder | null>;
};

export type Catalog = {
  entries: CatalogEntry[];
  get(kind: CatalogKind, slug: string): CatalogEntry | undefined;
  list(kind: CatalogKind): CatalogEntry[];
  /** Case-insensitive match on title, summary, category, keywords and components. */
  search(query: string): CatalogEntry[];
  load(entry: CatalogEntry): Promise<CatalogBuilder | null>;
  /** The entry that shows a component best: an element entry featuring it first, else any entry that uses it. */
  forComponent(componentId: string): CatalogEntry | undefined;
};

export const entryKey = (e: Pick<CatalogEntry, "kind" | "slug">) => `${e.kind}/${e.slug}`;
export const catalogPath = (e: Pick<CatalogEntry, "kind" | "slug">, base = "/playground") => `${base}/${e.kind}/${e.slug}`;

/** Later sources win on a clash, so a host can replace a teaser with the real entry. */
export function createCatalog(...sources: CatalogSource[]): Catalog {
  const byKey = new Map<string, { entry: CatalogEntry; source: CatalogSource }>();
  for (const source of sources) for (const entry of source.entries) byKey.set(entryKey(entry), { entry, source });
  const entries = [...byKey.values()].map((v) => v.entry);
  const norm = (s: string) => s.toLowerCase();
  return {
    entries,
    get: (kind, slug) => byKey.get(`${kind}/${slug}`)?.entry,
    list: (kind) => entries.filter((e) => e.kind === kind),
    search(query) {
      const words = norm(query).split(/\s+/).filter(Boolean);
      if (!words.length) return entries;
      return entries.filter((e) => {
        const hay = norm([e.title, e.summary, e.category, ...(e.keywords ?? []), ...(e.components ?? []), ...e.interactions].join(" "));
        return words.every((w) => hay.includes(w));
      });
    },
    async load(entry) {
      const hit = byKey.get(entryKey(entry));
      if (!hit || entry.href) return null;
      return hit.source.load(entry);
    },
    forComponent(id) {
      return entries.find((e) => e.kind === "elements" && e.components?.[0] === id && !e.href)
        ?? entries.find((e) => e.kind === "elements" && e.components?.includes(id) && !e.href)
        ?? entries.find((e) => e.components?.includes(id) && !e.href);
    },
  };
}

/**
 * Builds an entry into a validated project with ids that are the same every time (n0, n1…), so the
 * server's render and the browser's agree, a remix saved yesterday still matches today's build, and
 * selection survives Reset.
 */
export function buildCatalogProject(entry: Pick<CatalogEntry, "kind" | "slug">, build: CatalogBuilder, registry: ComponentRegistry, limits?: BuilderLimits): Project {
  let i = 0;
  const built = build(() => `n${(i++).toString(36)}`);
  return validateProject({ v: 1, id: `p-${entry.kind}-${entry.slug}`, updatedAt: 0, ...built, entry: `${entry.kind}/${entry.slug}` }, registry, limits).value;
}
