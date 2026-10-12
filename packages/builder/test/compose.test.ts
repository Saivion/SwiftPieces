import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogApp, createCatalog, FREE_LIMITS, generateProject, nd, validateProject, type CatalogEntry, type CatalogSource, type Project, type ScreenNode } from "../src/index.js";
import { patternsCatalogSource } from "../src/definitions/catalog/index.js";
import { createPersistence } from "../src/react/playground/persist.js";
import { MAX_TABS, createPlayStore } from "../src/react/playground/store.js";
import { assertWellFormedSwift, registry } from "./helpers.js";

// Composing: screens from several entries brought into one project, then reordered and removed.
// The free recreations (the ones built in this package), and a small tabbed app of the tests' own
// for a second app's tab roots.

/** Two tabs, each a tab root to bring into another tabbed app. */
const tabsFixture: CatalogEntry = { kind: "flows", slug: "test-tabs", title: "Test tabs", category: "Test", summary: "Two tabs.", description: "Two tabs, for tests.", availability: "free", try: [], interactions: [], steps: [{ title: "Home", transition: "tab" }, { title: "Friends", transition: "tab" }] };
const fixtures: CatalogSource = {
  entries: [tabsFixture],
  load: async () =>
    catalogApp({
      name: "TestTabs",
      shell: "tabs",
      screens: () => [
        { key: "home", name: "HomeView", tab: { title: "Home", icon: "house" }, children: [nd("text", { text: "Home" })] },
        { key: "friends", name: "FriendsView", tab: { title: "Friends", icon: "person.2" }, children: [nd("text", { text: "Friends" })] },
      ],
    }),
};

const catalog = createCatalog(patternsCatalogSource, fixtures);
const flows = catalog.entries.filter((e) => e.availability === "free" && (e.steps?.length ?? 0) >= 3);

async function storeFor(entry: CatalogEntry) {
  const store = createPlayStore({}, { registry, limits: FREE_LIMITS, catalog, persist: createPersistence("test"), track: () => {} });
  await store.open(entry);
  assert.equal(store.getState().status, "ready", entry.slug);
  return store;
}

const nodeIds = (p: Project) => {
  const out: string[] = [];
  const walk = (n: ScreenNode) => (out.push(n.id), n.children?.forEach(walk));
  p.screens.forEach((s) => walk(s.root));
  return out;
};

test("screens from other entries come in with fresh ids, unique names, and a valid project", async () => {
  const [home, a, b] = flows;
  const store = await storeFor(home);
  const first = store.getState().project!;
  // Make room, then add from two other entries, one of them twice.
  store.removeScreen(first.screens[first.screens.length - 1].id);
  store.removeScreen(store.getState().project!.screens[1].id);
  assert.ok(await store.importScreen(a, 0));
  assert.ok(await store.importScreen(b, 1, { at: 0 }));
  if (store.getState().project!.screens.length < FREE_LIMITS.maxScreens) assert.ok(await store.importScreen(b, 1));
  const p = store.getState().project!;

  const ids = nodeIds(p);
  assert.equal(new Set(ids).size, ids.length, "node ids are unique");
  assert.equal(new Set(p.screens.map((s) => s.id)).size, p.screens.length, "screen ids are unique");
  assert.equal(new Set(p.screens.map((s) => s.name)).size, p.screens.length, "view names are unique");
  // Validation keeps it as is (nothing dropped), and it generates well-formed Swift.
  const v = validateProject(p, registry, FREE_LIMITS);
  assert.deepEqual(v.issues, []);
  const files = generateProject(p, registry).files;
  for (const f of files) if (f.path.endsWith(".swift")) assertWellFormedSwift(f.content, f.path);
  assert.ok(store.isComposed());
});

test("replacing keeps the slot, the id and the tab place, so links into it still arrive", async () => {
  const [home, other] = flows;
  const store = await storeFor(home);
  const before = store.getState().project!;
  const target = before.screens[1];
  assert.ok(await store.importScreen(other, 0, { replace: target.id }));
  const after = store.getState().project!;
  assert.equal(after.screens.length, before.screens.length);
  assert.equal(after.screens[1].id, target.id);
  assert.notEqual(after.screens[1].root, target.root);
  if (target.tab) assert.equal(after.screens[1].tab?.icon, target.tab.icon);
  // Replacing alone doesn't change the flow's shape.
  assert.equal(store.isComposed(), false);
});

test("the free limit holds, the last screen can't be removed, moves reorder, undo restores", async () => {
  const store = await storeFor(flows[0]);
  while (store.getState().project!.screens.length < FREE_LIMITS.maxScreens) assert.ok(await store.importScreen(flows[1], 0));
  assert.equal(await store.importScreen(flows[1], 0), false, "over the limit");
  const p = store.getState().project!;
  const last = p.screens[p.screens.length - 1].id;
  store.moveScreen(last, 0);
  assert.equal(store.getState().project!.screens[0].id, last);
  store.undo();
  assert.equal(store.getState().project!.screens[p.screens.length - 1].id, last);
  for (const s of [...store.getState().project!.screens]) store.removeScreen(s.id);
  assert.equal(store.getState().project!.screens.length, 1);
});

test("links to screens that didn't come along are cleared", async () => {
  const [home, other] = flows;
  const store = await storeFor(home);
  assert.ok(await store.importScreen(other, 0, { replace: store.getState().project!.screens[0].id }));
  const p = store.getState().project!;
  const ids = new Set(p.screens.map((s) => s.id));
  const walk = (n: ScreenNode) => {
    const def = registry.get(n.component);
    for (const prop of def?.properties ?? []) {
      const v = n.props[prop.id];
      if (prop.type === "link" && typeof v === "string" && v && v !== "back") assert.ok(ids.has(v.replace(/^(sheet|root):/, "")), `${n.component}.${prop.id} → ${v}`);
    }
    n.children?.forEach(walk);
  };
  p.screens.forEach((s) => walk(s.root));
});

test("the tab bar follows the screens: imports join while there's room, the nav stays in step, toggles move screens in and out", async () => {
  const bySlug = (slug: string) => catalog.entries.find((e) => e.slug === slug)!;
  const store = await storeFor(bySlug("podcast-player"));
  const tabs = () => store.getState().project!.screens.filter((s) => s.tab);
  const nav = () => store.getState().nav;
  const check = () => {
    // One stack per tab, each rooted at its tab, and the tab showing is the one the bar lights.
    const roots = tabs().map((s) => s.id);
    assert.deepEqual(nav().stacks.map((s) => s[0]), roots);
    assert.ok(nav().tab < roots.length);
  };
  const start = tabs().length;
  // A tab root from another app joins the tab bar and shows as its tab.
  assert.ok(await store.importScreen(tabsFixture, 1));
  check();
  assert.equal(tabs().length, start + 1);
  assert.ok(store.getState().project!.screens.find((s) => s.id === nav().stacks[nav().tab][0])?.tab, "the added tab is showing");
  // A pushed screen shows pushed on the tab showing, never as a stray root.
  const pushed = store.getState().project!.screens.find((s) => !s.tab)!;
  store.showScreen(pushed.id);
  check();
  assert.equal(nav().stacks[nav().tab].at(-1), pushed.id);
  // Into the bar and out again.
  store.setInTabBar(pushed.id, true);
  check();
  assert.ok(tabs().some((s) => s.id === pushed.id));
  assert.equal(nav().stacks[nav().tab][0], pushed.id, "it now shows as its own tab");
  store.setInTabBar(pushed.id, false);
  check();
  // The bar caps at five.
  while (tabs().length < MAX_TABS) store.setInTabBar(store.getState().project!.screens.find((s) => !s.tab)!.id, true);
  const spare = store.getState().project!.screens.find((s) => !s.tab);
  if (spare) {
    store.setInTabBar(spare.id, true);
    assert.equal(tabs().length, MAX_TABS);
  }
  // Undo walks back through it with the nav still in step.
  store.undo();
  check();
  // Swift for the result is well formed.
  for (const f of generateProject(store.getState().project!, registry).files) if (f.path.endsWith(".swift")) assertWellFormedSwift(f.content, f.path);
});

test("taking the tab bar down to one tab turns it off; a screen joining turns it back on as a dock", async () => {
  const store = await storeFor(catalog.entries.find((e) => e.slug === "podcast-player")!);
  const inBar = () => store.getState().project!.screens.filter((s) => s.tab).map((s) => s.id);
  while (inBar().length > 1) store.setInTabBar(inBar()[inBar().length - 1], false);
  const p1 = store.getState().project!;
  assert.equal(p1.shell, "single");
  assert.ok(p1.screens.every((s) => !s.tab));
  assert.equal(store.getState().nav.stacks.length, 1);
  store.setInTabBar(p1.screens[2].id, true);
  const p2 = store.getState().project!;
  assert.equal(p2.shell, "tabs");
  assert.deepEqual(inBar(), [p1.screens[0].id, p1.screens[2].id], "the first screen joins with it");
  assert.deepEqual(store.getState().nav.stacks.map((s) => s[0]), inBar());
  assert.ok(p2.screens.filter((s) => s.tab).every((s) => s.tab!.title && s.tab!.icon));
});

test("a screen brought in remembers where it came from, through validation (a saved remix)", async () => {
  const [home, other] = flows;
  const store = await storeFor(home);
  const first = store.getState().project!.screens[0];
  assert.ok(await store.importScreen(other, 1, { replace: first.id }));
  const p = store.getState().project!;
  assert.deepEqual(p.screens[0].source, { kind: other.kind, slug: other.slug, step: 1 });
  assert.equal(p.screens[1].source, undefined, "the entry's own screens carry nothing");
  const again = validateProject(JSON.parse(JSON.stringify(p)), registry, FREE_LIMITS).value;
  assert.deepEqual(again.screens[0].source, p.screens[0].source);
  const bad = validateProject({ ...p, screens: [{ ...p.screens[0], source: { kind: "../x", slug: 3, step: "a" } }] }, registry, FREE_LIMITS).value;
  assert.equal(bad.screens[0].source, undefined);
});

test("reopening a saved remix still knows which library screens are in it", async () => {
  const [home, other] = flows;
  const saved = new Map<string, string>();
  const g = globalThis as { window?: unknown };
  const had = g.window;
  g.window = { localStorage: { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v), removeItem: (k: string) => void saved.delete(k) } };
  try {
    const persist = createPersistence("reopen");
    const make = () => createPlayStore({}, { registry, limits: FREE_LIMITS, catalog, persist, track: () => {} });
    const first = make();
    await first.open(home);
    assert.ok(await first.importScreen(other, 1));
    const added = first.getState().project!.screens.at(-1)!;
    persist.flush();
    const again = make();
    await again.open(home);
    assert.ok(again.getState().project!.screens.some((s) => s.id === added.id), "the remix came back");
    assert.equal(again.getState().origins[added.id], `${other.kind}/${other.slug}#1`);
  } finally {
    g.window = had;
  }
});

test("a remix saved before screens recorded their source gets it back on reopening", async () => {
  const [home, other] = flows;
  const saved = new Map<string, string>();
  const g = globalThis as { window?: unknown };
  const had = g.window;
  g.window = { localStorage: { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v), removeItem: (k: string) => void saved.delete(k) } };
  try {
    const persist = createPersistence("legacy");
    const make = () => createPlayStore({}, { registry, limits: FREE_LIMITS, catalog, persist, track: () => {} });
    const first = make();
    await first.open(home);
    const replaced = first.getState().project!.screens[1].id;
    assert.ok(await first.importScreen(other, 2, { replace: replaced }));
    assert.ok(await first.importScreen(other, 1));
    const added = first.getState().project!.screens.at(-1)!.id;
    persist.flush();
    // Strip the sources, the way older saves were written.
    for (const [k, v] of saved) if (k.includes(":remix:")) {
      const j = JSON.parse(v);
      j.project.screens.forEach((sc: { source?: unknown }) => delete sc.source);
      saved.set(k, JSON.stringify(j));
    }
    const again = make();
    await again.open(home);
    for (let i = 0; i < 50 && !again.getState().project!.screens.find((s) => s.id === added)?.source; i++) await new Promise((r) => setTimeout(r, 10));
    const p = again.getState().project!;
    assert.deepEqual(p.screens.find((s) => s.id === added)?.source, { kind: other.kind, slug: other.slug, step: 1 });
    assert.deepEqual(p.screens.find((s) => s.id === replaced)?.source, { kind: other.kind, slug: other.slug, step: 2 });
    assert.equal(p.screens[0].source, undefined, "the entry's own screens stay as they are");
    assert.equal(again.getState().origins[added], `${other.kind}/${other.slug}#1`);
  } finally {
    g.window = had;
  }
});

test("picking works like a design tool: outermost first, deeper inside the selection, siblings at the same level", async () => {
  const store = await storeFor(flows[0]);
  const screen = store.getState().project!.screens.find((s) => {
    const deep = (n: ScreenNode, d: number): number => Math.max(d, ...(n.children ?? []).map((c) => deep(c, d + 1)));
    return deep(s.root, 0) >= 3;
  })!;
  // A leaf at depth 3 or more.
  const leafPath = (() => {
    const walk = (n: ScreenNode, path: string[]): string[] | null => {
      const p = [...path, n.id];
      if (p.length >= 4 && !n.children?.length) return p;
      for (const c of n.children ?? []) {
        const hit = walk(c, p);
        if (hit) return hit;
      }
      return null;
    };
    return walk(screen.root, [])!;
  })();
  const leaf = leafPath[leafPath.length - 1];
  const sel = () => store.getState().selected?.nodeId;
  store.pick(leaf);
  assert.equal(sel(), leafPath[1], "the outermost part first");
  store.pick(leaf);
  assert.equal(sel(), leafPath[2], "a click inside the selection goes one deeper");
  store.pick(leaf, { deep: true });
  assert.equal(sel(), leaf, "⌘-click goes to the innermost");
  store.pick(leaf);
  assert.equal(sel(), leaf, "and stays there");
  store.pick(screen.root.id);
  assert.equal(sel(), screen.root.id, "the screen's own background picks the screen");
  store.pick(null);
  assert.equal(sel(), undefined);
});
