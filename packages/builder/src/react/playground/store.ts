// The Playground's state: one small external store read through selectors, so a remix re-renders
// the edited node and the panel that shows it, not the explorer, the device chrome or the code.
// Everything here is local. Opening an entry loads its content chunk once; every edit after that
// is a pure tree operation in memory, autosaved to this browser.
import { useSyncExternalStore } from "react";
import { buildCatalogProject, entryKey, type Catalog, type CatalogEntry, type CatalogKind } from "../../core/catalog.js";
import { firstNodeOf } from "../../core/inspect.js";
import type { ComponentRegistry } from "../../core/registry.js";
import type { BuilderLimits, Project, PropValue, Props, Screen, ScreenNode, Theme } from "../../core/schema.js";
import { groundEntry } from "../../core/palette.js";
import { cloneWithNewIds, countNodes, duplicateNode, findNode, insertNode, moveInto, moveSibling, newId, parentOf, pathTo, removeNode, replaceProps, updateProp } from "../../core/tree.js";
import { defaultProps } from "../../core/registry.js";
import { parseLink } from "../../core/generate.js";
import { pruneLinks, toTypeName, validateProject, withFreshScreenIds } from "../../core/validate.js";
import { buildFingerprint, type Persistence, type SavedRemix } from "./persist.js";

export type Mode = "interact" | "inspect";
export type RightTab = "inspect" | "code" | "map";
/** Docked layout's panel: the host's sidebar, the screen library, the style, or the inspector tools. */
export type PanelView = "host" | "screens" | "style" | "tools";
/** How the device got to its current screen, so it animates the right way. */
export type NavMove = "reset" | "push" | "pop" | "present" | "dismiss" | "tab" | "replace";

/** The device's navigation: one stack per tab (one tab for a single-screen app), and sheets on top. */
export type Nav = { tab: number; stacks: string[][]; sheets: string[][]; move: NavMove; seq: number };

export type Status = "empty" | "loading" | "ready" | "locked" | "missing";

export type PlayState = {
  entry: CatalogEntry | null;
  status: Status;
  project: Project | null;
  /** The entry as built, for Reset and for knowing whether anything was remixed. */
  base: Project | null;
  remixed: boolean;
  /** Where the current project came from: the entry, a saved remix, a shared link. */
  origin: { kind: "entry" } | { kind: "saved"; id: string } | { kind: "shared" };
  nav: Nav;
  selected: { screenId: string; nodeId: string } | null;
  /** The node under the pointer in Inspect mode. */
  hover: string | null;
  mode: Mode;
  tab: RightTab;
  /**
   * Docked layout (one panel, no right column): whether the panel shows the host's own sidebar or
   * the inspector tools (Inspect, SwiftUI, Map). Picking a component or a tool switches to tools.
   */
  panel: PanelView;
  /**
   * Where each screen of the project came from, as "kind/slug#step" (an entry and its screen), for
   * marking library screens that are already in the app. The entry's own screens are seeded on open;
   * imports add theirs. Session only: a restored remix knows its entry's screens, not its imports.
   */
  origins: Record<string, string>;
  scheme: "dark" | "light";
  /** The stage: the running app ("one"), or every screen side by side, still ("all"). */
  canvas: "one" | "all";
  /** Whether the stage shows the screenshot that inspired the screen showing. */
  reference: boolean;
  /**
   * A request to bring a screen (or a part of it) into view on the canvas, from the Map. `seq`
   * changes on every request, so asking for the same thing twice still moves the canvas.
   */
  focus: { screenId: string; nodeId: string | null; seq: number } | null;
  explore: { kind: CatalogKind | "saved"; query: string };
  /** Small-screen sheets. */
  drawer: null | "explore" | "inspect";
  /**
   * A library screen waiting for its target: Replace was pressed on it, and the screen strip is
   * asking which screen it replaces. Null otherwise.
   */
  replacing: { kind: CatalogKind; slug: string; step: number; title: string } | null;
  recent: string[];
  favorites: string[];
  saved: SavedRemix[];
  notice: { text: string; seq: number } | null;
};

type Deps = {
  registry: ComponentRegistry;
  limits: BuilderLimits;
  catalog: Catalog;
  persist: Persistence;
  track(event: string, props?: Record<string, string | number>): void;
};

const COALESCE_MS = 600;
const HISTORY = 80;

const emptyNav = (): Nav => ({ tab: 0, stacks: [[]], sheets: [], move: "reset", seq: 0 });

/** Tab roots: in a tabs app, the screens with a tab item, in order; otherwise just the first screen. */
export function tabRoots(project: Project): Screen[] {
  if (project.shell === "tabs") {
    const tabs = project.screens.filter((s) => s.tab);
    if (tabs.length) return tabs;
  }
  return project.screens.slice(0, 1);
}

function startNav(project: Project, seq = 0): Nav {
  const roots = tabRoots(project);
  return { tab: 0, stacks: roots.map((s) => [s.id]), sheets: [], move: "reset", seq };
}

/** A tab bar holds up to five screens, as iOS shows before it adds More. */
export const MAX_TABS = 5;

/** Tab items a screen can get when it joins the tab bar, by what its name says it is. */
const TAB_GUESSES: Array<[RegExp, string]> = [
  [/home|today|feed|now/i, "house"], [/search|find|explore|discover/i, "magnifyingglass"], [/profile|account|me\b|you/i, "person"],
  [/setting|prefer/i, "gearshape"], [/history|stats|insight|trend|report|progress/i, "chart.bar"], [/calendar|month|week|plan|schedule/i, "calendar"],
  [/inbox|message|chat/i, "bubble.left"], [/friend|circle|people|social/i, "person.2"], [/library|book|read/i, "book"], [/saved|favorite/i, "bookmark"],
  [/map|place|trip/i, "map"], [/shop|cart|store/i, "cart"], [/body|health|heart|feel/i, "heart"], [/sleep|night/i, "moon"], [/music|listen|play/i, "music.note"],
];

/** The tab item a screen joins the tab bar with: its own, else its title and a symbol guessed from it. */
export function tabItemFor(screen: Screen, taken: string[] = []): { title: string; icon: string } {
  if (screen.tab) return screen.tab;
  const title = (typeof screen.root.props.title === "string" && screen.root.props.title.trim()) || screen.name.replace(/View\d*$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
  const guess = TAB_GUESSES.find(([re]) => re.test(title) || re.test(screen.name))?.[1];
  const fallback = ["house", "star", "square.grid.2x2", "bookmark", "bell", "tray"].find((i) => !taken.includes(i)) ?? "star";
  return { title: title.slice(0, 24), icon: guess && !taken.includes(guess) ? guess : fallback };
}

/**
 * Where a screen that isn't a tab lives: the first tab whose screens lead to it (following the links
 * on them), with the path of pushes from the tab down to it. Null when no tab leads there.
 */
export function pathFromTabs(project: Project, id: string): { tab: number; path: string[] } | null {
  const byId = new Map(project.screens.map((s) => [s.id, s]));
  const roots = tabRoots(project);
  const rootIds = new Set(roots.map((r) => r.id));
  const leadsTo = (s: Screen): string[] => {
    const out: string[] = [];
    const walk = (n: ScreenNode) => {
      for (const v of Object.values(n.props)) {
        if (typeof v !== "string") continue;
        const l = parseLink(v);
        if ((l.mode === "push" || l.mode === "sheet") && byId.has(l.id) && !rootIds.has(l.id)) out.push(l.id);
      }
      n.children?.forEach(walk);
    };
    walk(s.root);
    return out;
  };
  for (let tab = 0; tab < roots.length; tab++) {
    const from = new Map<string, string>();
    const queue = [roots[tab].id];
    while (queue.length) {
      const at = queue.shift()!;
      if (at === id) {
        const path = [at];
        while (from.has(path[0])) path.unshift(from.get(path[0])!);
        return { tab, path };
      }
      for (const next of leadsTo(byId.get(at)!)) if (!from.has(next) && next !== roots[tab].id) (from.set(next, at), queue.push(next));
    }
  }
  return null;
}

/**
 * Fits the navigation to the project's screens after they change (added, removed, moved in or out of
 * the tab bar): one stack per tab root, each keeping what was pushed on it, sheets without screens
 * that are gone. The screen showing stays showing: as its tab when it is now a tab root, else pushed
 * on the current tab when nothing holds it any more.
 */
export function reconcileNav(project: Project, nav: Nav): Omit<Nav, "seq"> | null {
  const ids = new Set(project.screens.map((s) => s.id));
  const roots = tabRoots(project);
  const cur = currentScreenId(nav);
  const prevRoot = nav.stacks[nav.tab]?.[0];
  const stacks = roots.map((r) => {
    const old = nav.stacks.find((s) => s[0] === r.id);
    return old ? old.filter((id, i) => i === 0 || (ids.has(id) && !roots.some((x) => x.id === id))) : [r.id];
  });
  const sheets = nav.sheets.map((s) => s.filter((id) => ids.has(id))).filter((s) => s.length);
  let tab = Math.max(0, roots.findIndex((r) => r.id === prevRoot));
  if (cur && ids.has(cur)) {
    const asRoot = roots.findIndex((r) => r.id === cur);
    if (asRoot >= 0) {
      tab = asRoot;
      stacks[tab] = [cur];
    } else if (!stacks.some((s) => s.includes(cur)) && !sheets.some((s) => s.includes(cur))) {
      const home = pathFromTabs(project, cur);
      if (home) (tab = home.tab), (stacks[tab] = home.path);
      else stacks[tab] = [stacks[tab][0], cur];
    }
  }
  const same = tab === nav.tab && JSON.stringify(stacks) === JSON.stringify(nav.stacks) && JSON.stringify(sheets) === JSON.stringify(nav.sheets);
  return same ? null : { tab, stacks, sheets, move: "reset" };
}

/** The screen on top: the top of the frontmost sheet, else the top of the current tab. */
export function currentScreenId(nav: Nav): string | null {
  const layer = nav.sheets.length ? nav.sheets[nav.sheets.length - 1] : nav.stacks[nav.tab];
  return layer?.[layer.length - 1] ?? null;
}

/** A screen's shape: its components, nested, without ids or text, to recognise a copied screen. */
function shapeOf(n: ScreenNode): string {
  return n.children?.length ? `${n.component}(${n.children.map(shapeOf).join(",")})` : n.component;
}

export function createPlayStore(initial: Partial<PlayState>, deps: Deps) {
  let state: PlayState = {
    entry: null,
    status: "empty",
    project: null,
    base: null,
    remixed: false,
    origin: { kind: "entry" },
    nav: emptyNav(),
    selected: null,
    hover: null,
    mode: "interact",
    tab: "inspect",
    panel: "host",
    origins: {},
    scheme: "dark",
    canvas: "one",
    reference: true,
    focus: null,
    explore: { kind: "screens", query: "" },
    drawer: null,
    replacing: null,
    recent: [],
    favorites: [],
    saved: [],
    notice: null,
    ...initial,
  };
  const listeners = new Set<() => void>();
  const past: Project[] = [];
  const future: Project[] = [];
  let lastKey = "";
  let lastAt = 0;
  let openSeq = 0;
  /** The open that found its entry locked, kept so a plan that arrives later and covers it opens it as asked. */
  let lockedOpen: { entry: CatalogEntry; opts: { origin?: PlayState["origin"]; project?: unknown } } | null = null;
  const remixedOnce = new Set<string>();
  /** Entries whose saved remix has been checked for screens missing their source (recoverSources). */
  const recovered = new Set<string>();

  const emit = () => listeners.forEach((l) => l());
  const set = (patch: Partial<PlayState>) => {
    state = { ...state, ...patch };
    emit();
  };
  const notify = (text: string) => set({ notice: { text, seq: (state.notice?.seq ?? 0) + 1 } });

  const navSet = (nav: Omit<Nav, "seq">) => set({ nav: { ...nav, seq: state.nav.seq + 1 }, hover: null });

  /** Commits a new project, recording undo history. `key` coalesces rapid edits of one control. */
  function commit(project: Project, key?: string) {
    const prev = state.project;
    if (!prev || project === prev) return;
    const now = Date.now();
    if (!(key && key === lastKey && now - lastAt < COALESCE_MS)) {
      past.push(prev);
      if (past.length > HISTORY) past.shift();
    }
    future.length = 0;
    lastKey = key ?? "";
    lastAt = now;
    const next = { ...project, updatedAt: now };
    set({ project: next, remixed: true });
    if (state.entry && state.origin.kind === "entry") deps.persist.saveRemix(entryKey(state.entry), next, baseFingerprint());
  }

  /**
   * Remixes saved before screens recorded where they were brought in from: a screen that isn't one
   * of the entry's own (a new id, or an own id whose screen was replaced) is matched by its shape
   * against the catalog's screens, and the match is written back, so it shows its inspiration and
   * its library badge like any screen brought in since. Runs once per open, off the main path.
   */
  async function recoverSources(base: Project) {
    const p = state.project;
    const entry = state.entry;
    if (!p || !entry || recovered.has(entryKey(entry))) return;
    recovered.add(entryKey(entry));
    const own = new Map(base.screens.map((sc) => [sc.id, shapeOf(sc.root)]));
    const orphans = p.screens.filter((sc) => !sc.source && own.get(sc.id) !== shapeOf(sc.root));
    if (!orphans.length) return;
    const found = new Map<string, NonNullable<Screen["source"]>>();
    const wanted = new Map(orphans.map((sc) => [shapeOf(sc.root), sc.id]));
    for (const e of deps.catalog.entries) {
      if (!wanted.size) break;
      if (e.href || !e.steps?.length || !deps.limits.availability.includes(e.availability) || entryKey(e) === entryKey(entry)) continue;
      try {
        const build = await deps.catalog.load(e);
        if (!build) continue;
        buildCatalogProject(e, build, deps.registry, deps.limits).screens.forEach((sc, step) => {
          const id = wanted.get(shapeOf(sc.root));
          if (!id) return;
          found.set(id, { kind: e.kind, slug: e.slug, step });
          wanted.delete(shapeOf(sc.root));
        });
      } catch {
        // An entry that can't load just isn't a match.
      }
    }
    const now = state.project;
    if (!found.size || !now || state.entry !== entry) return;
    const next = { ...now, screens: now.screens.map((sc) => (found.has(sc.id) && !sc.source ? { ...sc, source: found.get(sc.id)! } : sc)) };
    const origins = { ...state.origins };
    for (const [id, src] of found) origins[id] = `${src.kind}/${src.slug}#${src.step}`;
    set({ project: next, origins });
    if (state.origin.kind === "entry") deps.persist.saveRemix(entryKey(entry), next, baseFingerprint());
  }

  /** The fingerprint of the build the open entry started from (what its autosave belongs to). */
  const baseFingerprint = () => (state.base ? buildFingerprint(state.base) : "");

  const screenOf = (nodeId: string): Screen | undefined => state.project?.screens.find((s) => findNode(s.root, nodeId));
  /** The first node of a component in a tree, depth first. */
  const firstOfKind = (root: ScreenNode, component: string): ScreenNode | null => {
    if (root.component === component) return root;
    for (const c of root.children ?? []) {
      const hit = firstOfKind(c, component);
      if (hit) return hit;
    }
    return null;
  };
  /** Whether `adding` more components fit the tier's per-screen cap; says so when they don't. */
  const roomFor = (screen: Screen, adding: number): boolean => {
    if (countNodes(screen.root) + adding <= deps.limits.maxNodesPerScreen) return true;
    notify(deps.limits.tier === "free" ? `A screen holds up to ${deps.limits.maxNodesPerScreen} components on Free. Pro raises it.` : `A screen holds up to ${deps.limits.maxNodesPerScreen} components.`);
    return false;
  };

  function mapScreen(screenId: string, fn: (root: ScreenNode) => ScreenNode, key?: string) {
    const p = state.project;
    if (!p) return;
    let changed = false;
    const screens = p.screens.map((s) => {
      if (s.id !== screenId) return s;
      const root = fn(s.root);
      if (root === s.root) return s;
      changed = true;
      return { ...s, root };
    });
    if (changed) commit({ ...p, screens }, key);
  }

  /** Replays flow steps up to `index`, so jumping to a step lands with the right stack and sheets. */
  function navForStep(project: Project, entry: CatalogEntry | null, index: number): Omit<Nav, "seq"> {
    // A composed project's screens no longer line up with the entry's steps: show the screen itself.
    const steps = isComposed(project) ? undefined : entry?.steps;
    const nav = startNav(project);
    const ids = project.screens.map((s) => s.id);
    if (!steps?.length) {
      const id = ids[index];
      if (!id) return nav;
      // In a tabs app a tab root shows as its tab; any other screen is pushed on the tab showing,
      // so the tab bar always says where you are.
      if (project.shell === "tabs" && nav.stacks.length) {
        const at = nav.stacks.findIndex((s) => s[0] === id);
        if (at >= 0) return { ...nav, tab: at };
        // Under the tab that leads to it, along the way it's reached; else on the tab showing.
        const home = pathFromTabs(project, id);
        const tab = home?.tab ?? Math.min(state.nav.tab, nav.stacks.length - 1);
        return { ...nav, tab, stacks: nav.stacks.map((s, i) => (i === tab ? home?.path ?? [s[0], id] : s)) };
      }
      return { ...nav, stacks: [[id]], tab: 0, move: "reset" };
    }
    let tab = 0;
    const stacks = nav.stacks.map((s) => [...s]);
    const sheets: string[][] = [];
    for (let i = 1; i <= Math.min(index, ids.length - 1); i++) {
      const t = steps[i]?.transition ?? "push";
      const id = ids[i];
      if (t === "sheet") sheets.push([id]);
      else if (t === "tab") {
        const at = stacks.findIndex((s) => s[0] === id);
        sheets.length = 0;
        if (at >= 0) tab = at;
        else stacks[tab] = [id];
      } else if (t === "replace") {
        sheets.length = 0;
        stacks[tab] = [id];
      } else if (sheets.length) sheets[sheets.length - 1].push(id);
      else stacks[tab].push(id);
    }
    return { tab, stacks, sheets, move: "reset" };
  }

  /**
   * Whether the project's screens differ from the entry as built (added, removed or reordered), so
   * the entry's flow steps and their transitions no longer describe it. A replaced screen keeps its
   * slot and id, so replacing alone doesn't count.
   */
  function isComposed(project: Project): boolean {
    const base = state.base;
    if (!base) return false;
    return project.screens.length !== base.screens.length || project.screens.some((s, i) => s.id !== base.screens[i].id);
  }

  let importSeq = 0;
  /** Ids no build will ever produce ("n0", "n1"… are build ids), unique across imports. */
  const importId = (prefix: string) => {
    const tag = `${prefix}${Date.now().toString(36)}${(importSeq++).toString(36)}`;
    let i = 0;
    return () => `${tag}${(i++).toString(36)}`;
  };

  /** A Swift type name that no other screen in the project uses ("TodayView" → "TodayView2"). */
  function uniqueName(name: string, screens: Screen[], except?: string): string {
    const taken = new Set(screens.filter((s) => s.id !== except).map((s) => s.name));
    const base = toTypeName(name, "ScreenView");
    if (!taken.has(base)) return base;
    const stem = base.replace(/View$/, "");
    for (let n = 2; ; n++) {
      const next = `${stem}${n}View`;
      if (!taken.has(next)) return next;
    }
  }

  /** Commits a change to the project's screens: links to missing screens cleared, one undo step. */
  function commitScreens(project: Project, event: { via: string; from?: string }) {
    const next = pruneLinks(project, deps.registry);
    commit(next);
    syncNav();
    deps.track("screen_composed", { via: event.via, ...(event.from ? { from: event.from } : {}), screens: next.screens.length });
  }

  /** Keeps the navigation (and so the tab bar) true to the project's screens after they change. */
  function syncNav() {
    const p = state.project;
    const next = p ? reconcileNav(p, state.nav) : null;
    if (next) navSet(next);
  }

  const api = {
    getState: () => state,
    isComposed: () => (state.project ? isComposed(state.project) : false),
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    notify,

    /** Seeds the lists kept in this browser. Called once after mount (never during server render). */
    hydrateLocal() {
      const scheme = deps.persist.pref("scheme");
      const canvas = deps.persist.pref("canvas");
      const reference = deps.persist.pref("reference");
      set({
        recent: deps.persist.recent(), favorites: deps.persist.favorites(), saved: deps.persist.saved(),
        // The last light/dark used, unless the open app is set to one appearance (it shows in that).
        ...((scheme === "light" || scheme === "dark") && !(state.project?.theme && state.project.theme.appearance !== "system") ? { scheme } : {}),
        ...(canvas === "one" || canvas === "all" ? { canvas } : {}),
        ...(reference === "off" ? { reference: false } : {}),
      });
    },

    /** Shows a project for an entry, restoring this browser's remix of it unless told not to. */
    show(entry: CatalogEntry, project: Project, opts: { origin?: PlayState["origin"]; restore?: boolean; base?: Project } = {}) {
      const key = entryKey(entry);
      let shown = project;
      let remixed = false;
      const origin = opts.origin ?? { kind: "entry" };
      if (opts.restore !== false && origin.kind === "entry") {
        const draft = deps.persist.remix(key, buildFingerprint(opts.base ?? project));
        if (draft) {
          const v = validateProject(draft, deps.registry, deps.limits).value;
          if (v.screens.length) {
            shown = v;
            remixed = true;
          }
        }
      }
      if (origin.kind !== "entry") remixed = true;
      past.length = 0;
      future.length = 0;
      const focus = entry.kind === "elements" || entry.kind === "interactions" ? entry.components?.[0] : undefined;
      const hit = focus ? firstNodeOf(shown, focus) : null;
      const baseProject = opts.base ?? project;
      // Which catalog screen each screen answers, for the library's badges: a screen brought in says
      // so itself (it survives a reload in the saved remix); the entry's own go by their place in it.
      const origins: Record<string, string> = {};
      baseProject.screens.forEach((sc, i) => (origins[sc.id] = `${key}#${i}`));
      for (const sc of shown.screens) if (sc.source) origins[sc.id] = `${sc.source.kind}/${sc.source.slug}#${sc.source.step}`;
      set({
        entry,
        status: "ready",
        replacing: null,
        origins,
        project: shown,
        base: opts.base ?? project,
        remixed,
        origin,
        nav: startNav(shown, state.nav.seq + 1),
        selected: hit,
        hover: null,
        recent: typeof window === "undefined" ? state.recent : deps.persist.pushRecent(key),
      });
      // An app set to one appearance shows in it, and the top bar's light/dark says so.
      if (shown.theme && shown.theme.appearance !== "system" && shown.theme.appearance !== state.scheme) set({ scheme: shown.theme.appearance });
      deps.track(entry.kind === "flows" ? "flow_started" : "screen_viewed", { kind: entry.kind, slug: entry.slug, tier: deps.limits.tier });
      if (remixed) void recoverSources(baseProject);
    },

    /** Opens an entry: loads its content chunk, builds it, validates it against this plan. */
    async open(entry: CatalogEntry, opts: { origin?: PlayState["origin"]; project?: unknown } = {}) {
      const seq = ++openSeq;
      deps.persist.flush();
      if (entry.href || !deps.limits.availability.includes(entry.availability)) {
        lockedOpen = { entry, opts };
        set({ entry, status: "locked", project: null, base: null, selected: null, remixed: false });
        return;
      }
      lockedOpen = null;
      set({ entry, status: "loading", selected: null, hover: null });
      try {
        const build = await deps.catalog.load(entry);
        if (seq !== openSeq) return;
        if (!build) {
          set({ status: "missing", project: null, base: null });
          return;
        }
        const base = buildCatalogProject(entry, build, deps.registry, deps.limits);
        if (opts.project) {
          const v = validateProject(opts.project, deps.registry, deps.limits).value;
          api.show(entry, v, { origin: opts.origin ?? { kind: "shared" }, base, restore: false });
        } else {
          api.show(entry, base, { origin: opts.origin });
        }
      } catch {
        if (seq === openSeq) set({ status: "missing" });
      }
    },

    /** Opens a remix saved in this browser. */
    async openSaved(entry: CatalogEntry, id: string) {
      const raw = deps.persist.loadSaved(id);
      if (!raw) return notify("That remix is no longer in this browser.");
      await api.open(entry, { project: raw, origin: { kind: "saved", id } });
    },

    // ------------------------------------------------------------ Selection & modes
    /**
     * Picks what a click on a screen means, the way design tools do: the outermost part under the
     * pointer first; a click inside the selection goes one level deeper; a click on a neighbour picks
     * it at the same level. `deep` (⌘/Ctrl-click) goes straight to the innermost part.
     */
    pick(leafId: string | null, opts: { deep?: boolean; screenId?: string } = {}) {
      if (!leafId) return api.select(null);
      const screen = opts.screenId ? state.project?.screens.find((s) => s.id === opts.screenId) : screenOf(leafId);
      if (!screen) return;
      const path = pathTo(screen.root, leafId);
      if (!path.length) return;
      if (opts.deep) return api.select(leafId, screen.id);
      const sel = state.selected?.screenId === screen.id ? pathTo(screen.root, state.selected.nodeId) : [];
      let common = 0;
      while (common < sel.length && common < path.length && sel[common] === path[common]) common++;
      // The level where the click parts from the selection (never the screen itself when there is
      // something on it to pick), or one deeper when the click is inside the selection.
      const at = Math.min(Math.max(1, common), path.length - 1);
      api.select(path[at], screen.id);
    },
    select(nodeId: string | null, screenId?: string) {
      if (!nodeId) {
        if (state.selected) set({ selected: null });
        return;
      }
      const sid = screenId ?? screenOf(nodeId)?.id;
      if (!sid) return;
      if (state.selected?.nodeId === nodeId) return;
      set({ selected: { screenId: sid, nodeId }, tab: state.tab === "map" ? "inspect" : state.tab, panel: "tools" });
      const node = findNode(state.project!.screens.find((s) => s.id === sid)!.root, nodeId);
      if (node && node.component !== "screen") deps.track("component_inspected", { component: node.component, kind: state.entry?.kind ?? "", slug: state.entry?.slug ?? "" });
    },
    /** Brings a screen, or a part of it, into view on the canvas (the one-screen stage already shows it). */
    focusOn(screenId: string, nodeId: string | null = null) {
      set({ focus: { screenId, nodeId, seq: (state.focus?.seq ?? 0) + 1 } });
    },
    hover(nodeId: string | null) {
      if (state.hover !== nodeId) set({ hover: nodeId });
    },
    setMode(mode: Mode) {
      if (state.mode !== mode) set({ mode, hover: null });
    },
    setTab(tab: RightTab) {
      if (state.tab === tab && state.panel === "tools") return;
      set({ tab, panel: "tools" });
      if (tab === "code") deps.track("code_viewed", { kind: state.entry?.kind ?? "", slug: state.entry?.slug ?? "", scope: state.selected ? "component" : "screen" });
    },
    /**
     * Light or dark, from the top bar: the one appearance control. The preview follows it, and so
     * does an app that is set to one appearance (the export's preferredColorScheme), so what you see
     * is what you build. It isn't an edit to undo.
     */
    setScheme(scheme: "dark" | "light") {
      set({ scheme });
      deps.persist.setPref("scheme", scheme);
      const p = state.project;
      if (p?.theme && p.theme.appearance !== "system" && p.theme.appearance !== scheme) {
        const next = { ...p, theme: { ...p.theme, appearance: scheme }, updatedAt: Date.now() };
        set({ project: next });
        if (state.entry && state.origin.kind === "entry") deps.persist.saveRemix(entryKey(state.entry), next, baseFingerprint());
      }
    },
    /** `remember: false` changes the view for this visit only (a link that opens on one screen). */
    setCanvas(canvas: "one" | "all", opts: { remember?: boolean } = {}) {
      if (canvas === state.canvas) return;
      set({ canvas, hover: null });
      if (opts.remember !== false) deps.persist.setPref("canvas", canvas);
    },
    setReference(on: boolean) {
      set({ reference: on });
      deps.persist.setPref("reference", on ? "on" : "off");
    },
    setExplore(patch: Partial<PlayState["explore"]>) {
      set({ explore: { ...state.explore, ...patch } });
    },
    setPanel(panel: PlayState["panel"]) {
      if (state.panel !== panel) set({ panel });
    },
    setDrawer(drawer: PlayState["drawer"]) {
      if (state.drawer !== drawer) set({ drawer });
    },

    /** Starts (or, with null, ends) picking which screen a library screen replaces. */
    setReplacing(replacing: PlayState["replacing"]) {
      set({ replacing });
    },

    // ------------------------------------------------------------ Navigation (the running app)
    /** Follows a link value from a tap in the device. */
    act(link: string): boolean {
      const p = state.project;
      if (!p || !link) return false;
      const { mode, id } = parseLink(link);
      const nav = state.nav;
      if (mode === "back") return api.back();
      if (!p.screens.some((s) => s.id === id) || id === currentScreenId(nav)) return false;
      if (mode === "root") {
        // The end of onboarding or sign-in: everything presented goes, and the screen becomes the root.
        const at = nav.stacks.findIndex((s) => s[0] === id);
        if (at >= 0) navSet({ ...nav, tab: at, stacks: nav.stacks.map((s, i) => (i === at ? [id] : s)), sheets: [], move: "replace" });
        else navSet({ ...nav, stacks: nav.stacks.map((s, i) => (i === nav.tab ? [id] : s)), sheets: [], move: "replace" });
      } else if (mode === "sheet") {
        navSet({ ...nav, sheets: [...nav.sheets, [id]], move: "present" });
      } else if (nav.sheets.length) {
        const sheets = nav.sheets.map((s, i) => (i === nav.sheets.length - 1 ? [...s, id] : s));
        navSet({ ...nav, sheets, move: "push" });
      } else {
        // A tab root reached by a link switches tabs, as a TabView would.
        const at = nav.stacks.findIndex((s) => s[0] === id);
        if (at >= 0 && p.shell === "tabs") return api.setTabIndex(at), true;
        const stacks = nav.stacks.map((s, i) => (i === nav.tab ? [...s, id] : s));
        navSet({ ...nav, stacks, move: "push" });
      }
      api.stepReached();
      return true;
    },
    back(): boolean {
      const nav = state.nav;
      if (nav.sheets.length) {
        const top = nav.sheets[nav.sheets.length - 1];
        if (top.length > 1) {
          navSet({ ...nav, sheets: nav.sheets.map((s, i) => (i === nav.sheets.length - 1 ? s.slice(0, -1) : s)), move: "pop" });
        } else {
          navSet({ ...nav, sheets: nav.sheets.slice(0, -1), move: "dismiss" });
        }
        return true;
      }
      const stack = nav.stacks[nav.tab];
      if (stack.length > 1) {
        navSet({ ...nav, stacks: nav.stacks.map((s, i) => (i === nav.tab ? s.slice(0, -1) : s)), move: "pop" });
        return true;
      }
      return false;
    },
    setTabIndex(i: number) {
      const nav = state.nav;
      if (i === nav.tab && !nav.sheets.length) {
        // Tapping the current tab pops it to its root, as iOS does.
        if (nav.stacks[i].length > 1) navSet({ ...nav, stacks: nav.stacks.map((s, j) => (j === i ? s.slice(0, 1) : s)), move: "pop" });
        return;
      }
      navSet({ ...nav, tab: i, sheets: [], move: "tab" });
    },
    /** Restarts the app at its first screen. */
    restart() {
      const p = state.project;
      if (p) navSet({ ...startNav(p), move: "reset" });
    },
    /** Jumps to a flow step (or, outside flows, shows a screen on its own). */
    /**
     * Opens on one screen of the entry as built (a link to a particular screen): the running app,
     * on that screen, found by its original place so a remix that moved screens still lands on it.
     */
    openAtStep(step: number) {
      const p = state.project;
      if (!p) return;
      api.setCanvas("one", { remember: false });
      const id = state.base?.screens[step]?.id;
      if (id && p.screens.some((s) => s.id === id)) api.showScreen(id);
      else api.goToStep(Math.min(step, p.screens.length - 1));
    },
    goToStep(index: number) {
      const p = state.project;
      if (!p) return;
      navSet(navForStep(p, state.entry, index));
      api.stepReached();
    },
    /** Shows one screen: through its flow step when there is one, else by pushing it. */
    showScreen(screenId: string) {
      const p = state.project;
      if (!p || currentScreenId(state.nav) === screenId) return;
      const i = p.screens.findIndex((s) => s.id === screenId);
      if (i < 0) return;
      const tabAt = state.nav.stacks.findIndex((s) => s[0] === screenId);
      if (tabAt >= 0) return api.setTabIndex(tabAt);
      api.goToStep(i);
    },
    /** Records reaching the last step of a flow, once per open. */
    stepReached() {
      const p = state.project;
      const e = state.entry;
      if (!p || e?.kind !== "flows") return;
      const cur = currentScreenId(state.nav);
      if (cur && cur === p.screens[p.screens.length - 1].id) deps.track("flow_completed", { slug: e.slug });
    },

    // ------------------------------------------------------------ Remix
    setProp(nodeId: string, prop: string, value: PropValue) {
      const screen = screenOf(nodeId);
      if (!screen) return;
      mapScreen(screen.id, (root) => updateProp(root, nodeId, prop, value), `${nodeId}:${prop}`);
      api.remixedEvent(nodeId, prop);
    },
    applyProps(nodeId: string, props: Props, via: string) {
      const screen = screenOf(nodeId);
      if (!screen) return;
      mapScreen(screen.id, (root) => replaceProps(root, nodeId, props));
      api.remixedEvent(nodeId, via);
    },
    // ------------------------------------------------------------ Layout
    // Taking things out, adding them and moving them around inside a screen. Each is one undo step,
    // and the preview, the SwiftUI and Build follow, exactly like a property edit.
    /** Takes a component out of its screen (never the screen itself). */
    removeNode(nodeId: string) {
      const screen = screenOf(nodeId);
      if (!screen || screen.root.id === nodeId) return;
      const parent = parentOf(screen.root, nodeId);
      mapScreen(screen.id, (root) => removeNode(root, nodeId));
      set({ selected: parent && parent.id !== screen.root.id ? { screenId: screen.id, nodeId: parent.id } : null, hover: null });
    },
    /** Moves a component one place up (-1) or down (+1) among its siblings. */
    moveNode(nodeId: string, delta: -1 | 1) {
      const screen = screenOf(nodeId);
      if (!screen) return;
      mapScreen(screen.id, (root) => moveSibling(root, nodeId, delta));
    },
    /**
     * Moves a component to `index` among `parentId`'s children, counted without it (a drag's drop).
     * Dropping it where it already is changes nothing, so it leaves no undo step.
     */
    moveNodeTo(nodeId: string, parentId: string, index: number) {
      const screen = screenOf(nodeId);
      const node = screen && findNode(screen.root, nodeId);
      const parent = screen && findNode(screen.root, parentId);
      const pdef = parent && deps.registry.get(parent.component);
      if (!screen || !node || !parent || !pdef?.container || screen.root.id === nodeId) return;
      if (pdef.container.accepts?.length && !pdef.container.accepts.includes(node.component)) return;
      const now = parentOf(screen.root, nodeId);
      if (now?.id === parentId && (now.children ?? []).findIndex((c) => c.id === nodeId) === index) return;
      mapScreen(screen.id, (root) => moveInto(root, nodeId, parentId, index));
    },
    /** Copies a component (and everything in it) right after itself, and selects the copy. */
    duplicateNode(nodeId: string) {
      const screen = screenOf(nodeId);
      const node = screen && findNode(screen.root, nodeId);
      if (!screen || !node || screen.root.id === nodeId) return;
      if (!roomFor(screen, countNodes(node))) return;
      let copy: string | null = null;
      mapScreen(screen.id, (root) => {
        const out = duplicateNode(root, nodeId);
        copy = out.id;
        return out.root;
      });
      if (copy) set({ selected: { screenId: screen.id, nodeId: copy } });
    },
    /**
     * Adds a fresh component (its default props) inside `parentId`, at `index` (the end when
     * omitted), and selects it. Refuses what the parent doesn't accept or the tier can't use.
     */
    insertComponent(parentId: string, componentId: string, index?: number) {
      const screen = screenOf(parentId);
      const parent = screen && findNode(screen.root, parentId);
      const pdef = parent && deps.registry.get(parent.component);
      const def = deps.registry.get(componentId);
      if (!screen || !pdef?.container || !def || def.hidden) return;
      if (pdef.container.accepts?.length && !pdef.container.accepts.includes(componentId)) return;
      if (!deps.registry.usable(def, deps.limits)) {
        notify(`${def.name} comes with SwiftPieces Pro.`);
        return;
      }
      // One the app already has comes in as the app has it (its content, its settings), so a
      // reworked screen keeps the foundation its siblings share. Anything new starts from defaults.
      const existing = state.project!.screens.map((sc) => firstOfKind(sc.root, componentId)).find(Boolean);
      const node: ScreenNode = existing ? cloneWithNewIds(existing) : { id: newId(), component: def.id, props: defaultProps(def), ...(def.container ? { children: [] } : {}) };
      if (!roomFor(screen, countNodes(node))) return;
      mapScreen(screen.id, (root) => insertNode(root, parentId, node, index));
      set({ selected: { screenId: screen.id, nodeId: node.id } });
      api.remixedEvent(node.id, "insert");
    },
    /**
     * Turns a component into another one in the same place: the new one starts from its defaults
     * and keeps whatever props the two share (a title, a value), so content carries over.
     */
    swapComponent(nodeId: string, componentId: string) {
      const screen = screenOf(nodeId);
      const node = screen && findNode(screen.root, nodeId);
      const parent = screen && parentOf(screen.root, nodeId);
      const pdef = parent && deps.registry.get(parent.component);
      const def = deps.registry.get(componentId);
      if (!screen || !node || !parent || !def || def.hidden || node.component === componentId) return;
      if (pdef?.container?.accepts?.length && !pdef.container.accepts.includes(componentId)) return;
      if (!deps.registry.usable(def, deps.limits)) {
        notify(`${def.name} comes with SwiftPieces Pro.`);
        return;
      }
      const base = defaultProps(def);
      const props = { ...base };
      for (const [k, v] of Object.entries(node.props)) if (k in base && typeof base[k] === typeof v) props[k] = v;
      const next: ScreenNode = { id: newId(), component: def.id, props, ...(def.container ? { children: node.children ?? [] } : {}) };
      const at = (parent.children ?? []).findIndex((c) => c.id === nodeId);
      mapScreen(screen.id, (root) => insertNode(removeNode(root, nodeId), parent.id, next, at));
      set({ selected: { screenId: screen.id, nodeId: next.id }, hover: null });
      api.remixedEvent(next.id, "swap");
    },
    /** One analytics event per component per open: remixing is a step, not a stream of edits. */
    remixedEvent(nodeId: string, property: string) {
      const node = state.project?.screens.map((s) => findNode(s.root, nodeId)).find(Boolean);
      if (!node || !state.entry) return;
      const k = `${entryKey(state.entry)}:${node.component}`;
      if (remixedOnce.has(k)) return;
      remixedOnce.add(k);
      deps.track("component_remixed", { component: node.component, property: property.slice(0, 40), kind: state.entry.kind, slug: state.entry.slug });
    },
    /** Swaps a whole screen's tree (an AI remix), as one undoable step. */
    replaceScreenRoot(screenId: string, root: ScreenNode) {
      mapScreen(screenId, () => root);
      set({ selected: null });
    },
    setTheme(theme: Theme | undefined) {
      const p = state.project;
      if (!p) return;
      commit({ ...p, theme }, "theme");
      // A style set to one appearance moves the top bar's light/dark with it.
      if (theme && theme.appearance !== "system" && theme.appearance !== state.scheme) set({ scheme: theme.appearance });
      if (state.entry) api.remixedEvent(p.screens[0].root.id, "look");
    },
    /**
     * The visitor's plan, once the host knows it (a Pro session answers after the Playground is up).
     * Only what the Playground *offers* follows it: screen and component caps, advanced properties.
     * Everything that costs or keeps something (saves, AI, a Pro app's screens) is decided by the
     * server. When the plan opens the locked entry on the stage (a Pro session answering on a Pro
     * app's page), that entry opens now, the way it was asked for (a saved remix, a shared link).
     */
    setLimits(limits: BuilderLimits) {
      if (deps.limits === limits) return;
      deps.limits = limits;
      set({});
      const asked = lockedOpen;
      if (asked && state.status === "locked" && state.entry === asked.entry && !asked.entry.href && limits.availability.includes(asked.entry.availability)) void api.open(asked.entry, asked.opts);
    },
    // ------------------------------------------------------------ Compose
    /**
     * Brings one screen of any entry into this project: `replace` swaps a screen in place (it keeps
     * that screen's slot, id and tab item, so everything linking to it still arrives), otherwise it
     * is inserted at `at` (the end by default). The screen is copied with fresh ids and a unique
     * type name; its links to screens it didn't bring along are cleared. It takes the project's look.
     */
    async importScreen(entry: CatalogEntry, step: number, opts: { at?: number; replace?: string } = {}): Promise<boolean> {
      const p = state.project;
      if (!p) return false;
      if (entry.href || !deps.limits.availability.includes(entry.availability)) {
        notify("That screen is part of Pro.");
        return false;
      }
      if (!opts.replace && p.screens.length >= deps.limits.maxScreens) {
        notify(`Up to ${deps.limits.maxScreens} screens here. Replace one, or remove one first.`);
        return false;
      }
      let source: Project;
      try {
        const build = await deps.catalog.load(entry);
        if (!build) throw new Error("missing");
        source = buildCatalogProject(entry, build, deps.registry, deps.limits);
      } catch {
        notify("That screen couldn't be loaded.");
        return false;
      }
      const cur = state.project;
      if (!cur) return false;
      const fresh = withFreshScreenIds(source.screens, deps.registry, importId("s"));
      const picked = fresh[Math.max(0, Math.min(step, fresh.length - 1))];
      if (!picked) return false;
      // It takes this app's style: a light or dark forced by the app it came from is dropped, and so
      // is a colour field it was painted on (it sits on this app's ground instead).
      const cloned = cloneWithNewIds(picked.root, importId("i"));
      const { appearance: _forced, ...kept } = cloned.props;
      const { background: bg, ...unfielded } = kept;
      const rootProps = groundEntry(String(bg ?? "system")).field ? unfielded : kept;
      const root = { ...cloned, props: rootProps };
      const old = opts.replace ? cur.screens.find((s) => s.id === opts.replace) : undefined;
      const tabs = cur.shell === "tabs";
      const tabCount = tabs ? cur.screens.filter((s) => s.tab && s.id !== old?.id).length : 0;
      // A tab root in its own app joins the tab bar while there is room; anything else is a screen
      // pushed from the tabs (the strip's tab-bar toggle moves it in or out later).
      const joins = tabs && Boolean(picked.tab) && tabCount < MAX_TABS;
      const taken = cur.screens.filter((s) => s.tab && s.id !== old?.id).map((s) => s.tab!.icon);
      let screen: Screen;
      // A screen taking over a tab keeps the tab's place and icon but is labeled for what it now is.
      const label = (entry.steps?.[step]?.title ?? entry.title).slice(0, 24);
      const from = { kind: entry.kind, slug: entry.slug, step: Math.max(0, Math.min(step, fresh.length - 1)) };
      if (old) {
        screen = { source: from, id: old.id, name: uniqueName(picked.name, cur.screens, old.id), root, ...(old.tab ? { tab: { ...old.tab, title: picked.tab?.title ?? label } } : joins ? { tab: tabItemFor(picked, taken) } : {}) };
      } else {
        screen = { source: from, id: picked.id, name: uniqueName(picked.name, cur.screens), root, ...(joins ? { tab: tabItemFor(picked, taken) } : {}) };
      }
      const screens = old ? cur.screens.map((s) => (s.id === old.id ? screen : s)) : [...cur.screens];
      if (!old) screens.splice(Math.max(0, Math.min(opts.at ?? screens.length, screens.length)), 0, screen);
      const keepSelection = state.selected && state.selected.screenId !== old?.id;
      set({ selected: keepSelection ? state.selected : null, hover: null, origins: { ...state.origins, [screen.id]: `${entryKey(entry)}#${Math.max(0, Math.min(step, fresh.length - 1))}` } });
      commitScreens({ ...cur, screens }, { via: old ? "replace" : "add", from: entry.slug });
      // Show it: a replaced screen that was on screen stays put; anything else is brought forward.
      if (!old || currentScreenId(state.nav) !== old.id) api.showScreen(screen.id);
      notify(old ? "Screen replaced" : screen.tab ? "Added to the tab bar" : tabs && picked.tab ? `Screen added. The tab bar is full (${MAX_TABS} max)` : "Screen added");
      return true;
    },
    /**
     * Puts a screen in the tab bar or takes it out. A single-screen-root app becomes a tabs app with
     * the Floating Dock (its first screen joins too); taking out the second-to-last tab turns the bar
     * off again, since one tab is no tab bar.
     */
    setInTabBar(screenId: string, on: boolean) {
      const p = state.project;
      const screen = p?.screens.find((s) => s.id === screenId);
      if (!p || !screen || (p.shell === "tabs" && Boolean(screen.tab)) === on) return;
      let next: Project;
      if (on) {
        const current = p.shell === "tabs" ? p.screens.filter((s) => s.tab) : [];
        if (current.length >= MAX_TABS) {
          notify(`The tab bar holds up to ${MAX_TABS} screens. Take one out first.`);
          return;
        }
        const joining = new Set([screenId, ...(current.length ? [] : [p.screens[0].id])]);
        const taken = current.map((s) => s.tab!.icon);
        const screens = p.screens.map((s) => {
          if (!joining.has(s.id) || (p.shell === "tabs" && s.tab)) return s;
          const tab = tabItemFor(s, taken);
          taken.push(tab.icon);
          // A tab shows the tab bar: a screen that hid it (shown pushed before) stops hiding it.
          const { tabBar: _hidden, ...props } = s.root.props;
          return { ...s, tab, root: { ...s.root, props } };
        });
        next = { ...p, shell: "tabs", tabBar: p.shell === "tabs" ? p.tabBar : "dock", screens };
      } else {
        if (!screen.tab) return;
        const left = p.screens.filter((s) => s.tab && s.id !== screenId);
        const screens = p.screens.map((s) => (s.id === screenId || left.length < 2 ? (({ tab: _t, ...rest }) => rest)(s) : s));
        next = left.length < 2 ? { ...p, shell: "single", screens } : { ...p, screens };
      }
      commitScreens(next, { via: on ? "tab-in" : "tab-out" });
      notify(on ? "In the tab bar" : next.shell === "single" ? "Tab bar off" : "Out of the tab bar");
    },
    /** Renames a tab or changes its symbol. */
    setTabItem(screenId: string, item: Partial<{ title: string; icon: string }>) {
      const p = state.project;
      if (!p) return;
      const screens = p.screens.map((s) => (s.id === screenId && s.tab ? { ...s, tab: { ...s.tab, ...item, title: (item.title ?? s.tab.title).slice(0, 24) } } : s));
      commit({ ...p, screens }, `tab:${screenId}`);
    },
    /** Takes a screen out (never the last one). Links that pointed at it are cleared. */
    removeScreen(screenId: string) {
      const p = state.project;
      if (!p || p.screens.length <= 1) return;
      const at = p.screens.findIndex((s) => s.id === screenId);
      if (at < 0) return;
      const screens = p.screens.filter((s) => s.id !== screenId);
      const wasHere = currentScreenId(state.nav) === screenId || state.nav.stacks.some((st) => st.includes(screenId)) || state.nav.sheets.some((sh) => sh.includes(screenId));
      if (state.selected?.screenId === screenId) set({ selected: null });
      commitScreens({ ...p, screens }, { via: "remove" });
      if (wasHere) {
        const next = screens[Math.min(at, screens.length - 1)];
        navSet({ ...startNav(state.project!), move: "reset" });
        if (next) api.showScreen(next.id);
      }
    },
    /** Moves a screen to a new position. The first screen is where the app opens. */
    moveScreen(screenId: string, to: number) {
      const p = state.project;
      if (!p) return;
      const from = p.screens.findIndex((s) => s.id === screenId);
      const target = Math.max(0, Math.min(to, p.screens.length - 1));
      if (from < 0 || from === target) return;
      const screens = [...p.screens];
      const [moved] = screens.splice(from, 1);
      screens.splice(target, 0, moved);
      commitScreens({ ...p, screens }, { via: "move" });
    },
    reset() {
      const { entry, base, project } = state;
      if (!entry || !base || !project) return;
      past.push(project);
      future.length = 0;
      deps.persist.clearRemix(entryKey(entry));
      const keep = state.selected && base.screens.some((s) => findNode(s.root, state.selected!.nodeId));
      set({ project: base, remixed: false, origin: { kind: "entry" }, selected: keep ? state.selected : null });
      syncNav();
      notify("Back to the original");
    },
    undo() {
      const prev = past.pop();
      if (!prev || !state.project) return;
      future.push(state.project);
      lastKey = "";
      set({ project: prev, remixed: true });
      syncNav();
      if (state.entry && state.origin.kind === "entry") deps.persist.saveRemix(entryKey(state.entry), prev, baseFingerprint());
    },
    redo() {
      const next = future.pop();
      if (!next || !state.project) return;
      past.push(state.project);
      lastKey = "";
      set({ project: next, remixed: true });
      syncNav();
      if (state.entry && state.origin.kind === "entry") deps.persist.saveRemix(entryKey(state.entry), next, baseFingerprint());
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    // ------------------------------------------------------------ Saved & favorites
    saveRemix(title: string): boolean {
      const { entry, project } = state;
      if (!entry || !project) return false;
      const saved = deps.persist.save(entryKey(entry), title, project);
      if (!saved) {
        notify("This browser's storage is full, so the remix couldn't be saved.");
        return false;
      }
      set({ saved });
      notify(`Saved “${title}”`);
      deps.track("remix_saved", { kind: entry.kind, slug: entry.slug, via: "local" });
      return true;
    },
    removeSaved(id: string) {
      set({ saved: deps.persist.removeSaved(id) });
    },
    toggleFavorite(key: string) {
      set({ favorites: deps.persist.toggleFavorite(key) });
    },
  };
  return api;
}

export type PlayStore = ReturnType<typeof createPlayStore>;

export function usePlay<T>(store: PlayStore, selector: (s: PlayState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}
