// The Styles page (/styles): what its Screens view shows, built on the server with the Playground's
// own kit and validation, so the page ships plain nodes the Playground's renderers draw: one screen
// from each free app. The Components view is the bento canvas (components/styles/bento), drawn in
// the browser.
import { buildCatalogProject, createRegistry, FREE_LIMITS, freeDefinitions, type ScreenNode } from "@swiftpieces/builder";
import { apps, cdn, isProApp } from "@/lib/apps";
import { playgroundCatalog, playgroundPath } from "@/lib/playground";

export const STYLES_PATH = "/styles";

const registry = createRegistry(freeDefinitions);

/** One free app's screen, wearing the style. */
export type StyleScreen = { slug: string; app: string; title: string; icon: string; href: string; node: ScreenNode };

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
