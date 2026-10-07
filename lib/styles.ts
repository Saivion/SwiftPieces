// The Styles page (/styles): what its canvas shows, built on the server with the Playground's own
// kit and validation, so the page ships plain nodes and the components are the same ones the
// Playground runs. The canvas is a showcase of SwiftPieces components, each one live and labelled
// with what in a style it follows; the Screens view shows one screen from each free app.
import { buildCatalogProject, createRegistry, FREE_LIMITS, freeDefinitions, type ScreenNode } from "@swiftpieces/builder";
import { app, group, nd } from "@swiftpieces/builder/catalog";
import { apps, cdn, isProApp } from "@/lib/apps";
import { playgroundCatalog, playgroundPath } from "@/lib/playground";
import type { StyleFollow } from "@/components/styles/follows";

export const STYLES_PATH = "/styles";

const registry = createRegistry(freeDefinitions);

/** The canvas tiles drawn by the Playground's renderers (the palette and type tiles are the page's own). */
export type StyleTileId = "hero" | "track" | "pay" | "chart" | "goal" | "days";

/**
 * What a tile says about itself: its lead component (named, with its docs page), every component in
 * it, the parts of a style that reach them, and how to use it.
 */
export type StyleTileInfo = { name: string; docs: string | null; pieces: string[]; follows: StyleFollow[]; verb: string };

/** One free app's screen, wearing the style. */
export type StyleScreen = { slug: string; app: string; title: string; icon: string; href: string; node: ScreenNode };

const col = (props: Record<string, string | number | boolean>, children: ScreenNode[]) => nd("vstack", { spacing: 12, ...props }, children);
/** Room that grows: the canvas makes each tile's column as tall as the tile, and spacers share what's left. */
const room = () => nd("spacer", {});
/** A card: Style's card treatment (flat, raised, outlined, glass or bold) around a column. */
const card = (children: ScreenNode[], extra: Record<string, string | number | boolean> = {}) => nd("vstack", { spacing: 10, style: "card", padding: 18, radius: 20, alignment: "leading", ...extra }, children);
const text = (t: string, style: string, extra: Record<string, string | number | boolean> = {}) => nd("text", { text: t, style, ...extra });
const line = (label: string, value: string) => nd("hstack", { spacing: 8 }, [text(label, "subheadline", { color: "secondary" }), room(), text(value, "subheadline", { weight: "semibold" })]);

const row = (icon: string, iconColor: string, title: string, value: string) => nd("row", { icon, iconColor, title, value, accessory: "none" });

/**
 * Each tile: one moment of an app, built from SwiftPieces components and wearing the style, the
 * accent at its heart: a card that tilts, a plan to pick, a day's curve to scrub, a spending ring, a week, a
 * track that swells. `follows` names the parts of a style that visibly change it, measured by
 * drawing the tiles with one setting changed at a time (Motion, which a still can't show, from the
 * springs each piece animates with), so pointing at a setting lights up exactly the tiles it
 * changes. Re-measure when a tile's pieces change. The tiles themselves are neutral or a pastel of
 * the look's palette (components/styles/surfaces.ts), never the style's background.
 */
const TILES: Record<StyleTileId, { info: Pick<StyleTileInfo, "follows" | "verb">; lead: string; children: ScreenNode[] }> = {
  hero: {
    info: { follows: ["accent", "cards", "corners", "lists", "spacing", "headings", "titles", "body", "motion"], verb: "Tilt" },
    lead: "motion-card",
    children: [
      room(),
      nd("motion-card", { fill: "signal", height: 178 }, [
        nd("hstack", { spacing: 8 }, [text("Balance", "subheadline", { weight: "semibold" }), room(), nd("symbol", { icon: "wifi", size: 18, color: "primary" })]),
        text("$2,480.50", "largeTitle", { weight: "bold" }),
        room(),
        nd("hstack", { spacing: 8 }, [text("•••• 4821", "subheadline", { weight: "medium" }), room(), text("09 / 29", "subheadline", { weight: "medium" })]),
      ]),
      nd("hstack", { spacing: 8 }, [text("Recent", "headline"), room(), text("See all", "subheadline", { color: "accent" })]),
      group([row("cart", "green", "Groceries", "−$42.10"), row("cup.and.saucer", "orange", "Coffee", "−$4.50"), row("banknote", "blue", "Salary", "+$3,200")], { radius: 20 }),
      room(),
    ],
  },
  track: {
    info: { follows: ["accent", "spacing", "titles", "body", "motion"], verb: "Drag" },
    lead: "expanding-track",
    children: [room(), nd("expanding-track", { title: "Volume", value: 72 }), room()],
  },
  pay: {
    info: { follows: ["accent", "buttons", "buttonSize", "cards", "corners", "spacing", "body", "motion"], verb: "Tap" },
    lead: "choice",
    children: [
      room(),
      card([
        nd("choice", { title: "Pay in full", subtitle: "$480.00 today", badge: "Save 10%", trailing: "", group: "pay" }),
        nd("choice", { title: "Split it", subtitle: "Two payments of $240", trailing: "", group: "pay", selected: true }),
        nd("commit-button", { title: "Continue", successTitle: "Paid", collapses: false }),
      ], { padding: 12, spacing: 10 }),
      room(),
    ],
  },
  chart: {
    info: { follows: ["accent", "cards", "spacing", "titles", "body"], verb: "Drag" },
    lead: "area-scrub",
    children: [
      room(),
      card([
        nd("hstack", { spacing: 8, alignment: "top" }, [
          nd("vstack", { spacing: 2 }, [text("Lisbon", "title3", { weight: "bold" }), text("Mostly sunny · High 21°", "subheadline", { color: "secondary" })]),
          room(),
          nd("tag", { text: "Today", style: "tinted" }),
        ]),
        nd("area-scrub", { tint: "signal", height: 200 }),
      ], { padding: 18, spacing: 18 }),
      room(),
    ],
  },
  goal: {
    info: { follows: ["accent", "body", "motion"], verb: "Drag" },
    lead: "ring-breakdown",
    children: [room(), nd("ring-breakdown", { slices: "Housing: 1450, Food: 620, Transport: 310, Leisure: 270, Other: 150", currency: true, legend: false }), room()],
  },
  days: {
    info: { follows: ["accent", "spacing", "headings", "titles", "body"], verb: "Tap" },
    lead: "day-picker",
    children: [
      room(),
      nd("hstack", { spacing: 20 }, [
        nd("vstack", { spacing: 2 }, [text("October", "title3", { weight: "bold" }), text("3 plans this week", "subheadline", { color: "secondary" })]),
        nd("day-picker", { layout: "week", start: 12, selected: 14, today: 14, marked: "15, 17" }),
      ]),
      room(),
    ],
  },
};

/** The SwiftPieces pieces in a tile, by name, in the order they appear. */
function piecesIn(node: ScreenNode, out: string[] = []): string[] {
  const def = registry.get(node.component);
  if (def?.category === "pieces" && !out.includes(def.name)) out.push(def.name);
  for (const c of node.children ?? []) piecesIn(c, out);
  return out;
}

/**
 * Every tile, validated as the Playground validates a project (unknown components dropped, default
 * props filled) and given ids, with its label: its lead piece and that piece's docs page.
 */
export function styleTiles(): Record<StyleTileId, { node: ScreenNode; info: StyleTileInfo }> {
  const ids = Object.keys(TILES) as StyleTileId[];
  const project = buildCatalogProject(
    { kind: "screens", slug: "styles" },
    app({ name: "Styles", screens: () => ids.map((id) => ({ key: id, name: `${id[0].toUpperCase()}${id.slice(1)}View`, children: [col({ spacing: 14 }, TILES[id].children)] })) }),
    registry,
    FREE_LIMITS,
  );
  return Object.fromEntries(
    ids.map((id, i) => {
      const node = project.screens[i].root.children![0];
      const lead = registry.get(TILES[id].lead);
      return [id, { node, info: { ...TILES[id].info, name: lead?.name ?? id, docs: lead?.docs ?? null, pieces: piecesIn(node) } }];
    }),
  ) as Record<StyleTileId, { node: ScreenNode; info: StyleTileInfo }>;
}

/** Which screen of each free app the Screens view shows: the one each app is known for. */
const SCREENS: Record<string, number> = { waterllama: 0, "pocket-casts": 0, timepage: 5 };

/** One screen of each free app, as the Playground opens it (built from the app's own catalog entry). */
export async function styleScreens(): Promise<StyleScreen[]> {
  const free = apps.filter((a) => !isProApp(a) && a.slug in SCREENS);
  const out: StyleScreen[] = [];
  for (const a of free) {
    const build = await playgroundCatalog.load(a.pattern);
    if (!build) continue;
    const project = buildCatalogProject(a.pattern, build, registry, FREE_LIMITS);
    const screen = project.screens[SCREENS[a.slug]] ?? project.screens[0];
    out.push({ slug: a.slug, app: a.name, title: a.pattern.steps?.[SCREENS[a.slug]]?.title ?? a.pattern.title, icon: cdn(a.store.icon, 64), href: playgroundPath(a), node: screen.root });
  }
  return out;
}

/** The free apps a style can open in, for the studio's "Open in the Playground". */
export function styleApps(): Array<{ slug: string; name: string; icon: string; href: string }> {
  return apps.filter((a) => !isProApp(a)).map((a) => ({ slug: a.slug, name: a.name, icon: cdn(a.store.icon, 192), href: playgroundPath(a) }));
}
