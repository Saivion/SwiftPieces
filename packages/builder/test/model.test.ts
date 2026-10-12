import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FREE_LIMITS, countNodes, createCatalog, createRegistry, duplicateNode, findNode, freeDefinitions, insertNode,
  moveInto, moveSibling, pathTo, removeNode, updateProp, validateProject, validateScreenRoot, type ScreenNode, type SwiftPieceDefinition,
} from "../src/index.js";
import { freeCatalogSource, patternsCatalogSource } from "../src/definitions/catalog/index.js";
import { entryProject, registry } from "./helpers.js";

const tree = (): ScreenNode => ({
  id: "root", component: "screen", props: {},
  children: [
    { id: "a", component: "text", props: { text: "A" } },
    { id: "box", component: "vstack", props: {}, children: [{ id: "b", component: "text", props: { text: "B" } }] },
    { id: "c", component: "button", props: { title: "C" } },
  ],
});

test("updates share every untouched subtree", () => {
  const before = tree();
  const after = updateProp(before, "b", "text", "B2");
  assert.notEqual(after, before);
  assert.equal(after.children![0], before.children![0], "sibling kept");
  assert.equal(after.children![2], before.children![2], "sibling kept");
  assert.notEqual(after.children![1], before.children![1], "path rebuilt");
  assert.equal(findNode(after, "b")!.props.text, "B2");
  assert.equal(updateProp(after, "b", "text", "B2"), after, "no-op returns the same tree");
});

test("insert, remove, reorder, move and duplicate", () => {
  let t = tree();
  t = insertNode(t, "box", { id: "d", component: "divider", props: {} }, 0);
  assert.deepEqual(findNode(t, "box")!.children!.map((c) => c.id), ["d", "b"]);
  t = moveSibling(t, "c", -1);
  assert.deepEqual(t.children!.map((c) => c.id), ["a", "c", "box"]);
  assert.equal(moveSibling(t, "a", -1), t, "moving past the edge is a no-op");
  t = moveInto(t, "a", "box");
  assert.deepEqual(pathTo(t, "a"), ["root", "box", "a"]);
  assert.equal(moveInto(t, "box", "b"), t, "cannot move a container into its own child");
  const dup = duplicateNode(t, "box");
  assert.ok(dup.id && dup.id !== "box");
  assert.equal(countNodes(dup.root), countNodes(t) + 4);
  t = removeNode(dup.root, dup.id!);
  assert.equal(countNodes(t), 6);
  assert.equal(removeNode(t, "root"), t, "the screen itself is never removed");
});

test("validation keeps what is valid and explains what it dropped", () => {
  const { value, issues } = validateProject({
    name: "my cool app!",
    screens: [{
      name: "home",
      root: {
        id: "root", component: "screen", props: { spacing: 999, alignment: "sideways" },
        children: [
          { id: "t", component: "text", props: { text: "x".repeat(900), style: "enormous", color: "#ff00ff", extra: 1 } },
          { id: "t", component: "text", props: { text: 42 } },
          { component: "iframe", props: {} },
          { id: "btn", component: "button", props: {}, children: [{ component: "text", props: {} }] },
          { id: "nested", component: "screen", props: {} },
        ],
      },
    }],
  }, registry);
  assert.equal(value.name, "MyCoolApp");
  assert.equal(value.screens[0].name, "HomeView");
  const root = value.screens[0].root;
  assert.equal(root.props.spacing, 48, "clamped");
  assert.equal(root.props.alignment, "center", "bad select falls back to default");
  const [t1, t2] = root.children!;
  assert.equal((t1.props.text as string).length, 400);
  assert.equal(t1.props.style, "body");
  assert.equal(t1.props.color, "primary");
  assert.ok(!("extra" in t1.props));
  assert.equal(t2.props.text, "42");
  assert.notEqual(t1.id, t2.id, "duplicate ids are replaced");
  assert.equal(root.children!.length, 3);
  assert.equal(findNode(root, "btn")!.children, undefined);
  assert.ok(issues.some((i) => /unknown component/.test(i)));
  assert.ok(issues.some((i) => /can't hold/.test(i)));
  assert.ok(issues.some((i) => /only be the screen/.test(i)));
});

test("plan limits: Pro components, node counts and screen counts", () => {
  const proThing: SwiftPieceDefinition = { ...freeDefinitions.find((d) => d.id === "text")!, id: "pro-thing", availability: "pro" };
  const reg = createRegistry(freeDefinitions, [proThing]);
  const issues: string[] = [];
  const root = validateScreenRoot({ component: "screen", children: [{ component: "pro-thing" }, { component: "text" }] }, reg, FREE_LIMITS, issues);
  assert.deepEqual(root.children!.map((c) => c.component), ["text"]);
  assert.ok(issues.some((i) => /Pro component/.test(i)));

  const many = { component: "screen", children: Array.from({ length: 80 }, () => ({ component: "divider" })) };
  assert.equal(countNodes(validateScreenRoot(many, registry, FREE_LIMITS)), FREE_LIMITS.maxNodesPerScreen);

  const tooMany = validateProject({ screens: Array.from({ length: FREE_LIMITS.maxScreens + 2 }, (_, i) => ({ name: `S${i}` })) }, registry, FREE_LIMITS);
  assert.equal(tooMany.value.screens.length, FREE_LIMITS.maxScreens);
  assert.ok(tooMany.issues.length);
});

test("garbage never throws and always yields an openable project", () => {
  for (const junk of [null, 42, "x", [], { screens: "no" }, { screens: [null, 3] }, { screens: [{ root: [{ component: "text" }] }] }]) {
    const { value } = validateProject(junk, registry);
    assert.equal(value.screens[0].root.component, "screen");
  }
  const wrapped = validateProject({ screens: [{ root: [{ component: "text", props: { text: "hi" } }] }] }, registry).value;
  assert.equal(wrapped.screens[0].root.children![0].props.text, "hi");
});

test("every free catalog entry builds, validates cleanly and fits the free plan", async () => {
  const catalog = createCatalog(freeCatalogSource);
  assert.ok(catalog.entries.length >= 50, "a meaningful catalog");
  const keys = new Set<string>();
  for (const e of catalog.entries) {
    const key = `${e.kind}/${e.slug}`;
    assert.ok(!keys.has(key), `duplicate ${key}`);
    keys.add(key);
    assert.ok(e.description.length >= 80 && e.summary.length <= 90, `${key}: description or summary length`);
    assert.doesNotMatch(`${e.title} ${e.summary} ${e.description}`, /\u2014/, `${key}: no em dashes in copy`);
    const build = await catalog.load(e);
    assert.ok(build, `${key}: no build`);
    const raw = build(() => Math.random().toString(36).slice(2));
    const { value, issues } = validateProject(raw, registry, FREE_LIMITS);
    assert.deepEqual(issues, [], key);
    if (e.steps) assert.equal(e.steps.length, value.screens.length, `${key}: one step per screen`);
    for (const c of e.components ?? []) assert.ok(registry.get(c), `${key}: unknown component ${c}`);
  }
});

test("catalog builds are deterministic, so server and browser agree", () => {
  const a = entryProject("flows", "onboarding");
  const b = entryProject("flows", "onboarding");
  assert.deepEqual(a, b);
  assert.equal(a.screens[0].id, entryProject("flows", "onboarding").screens[0].id);
});

test("every component a catalog entry features has an entry that shows it", () => {
  // The free catalog and the app library's recreations together: app pieces were made for (and
  // are shown by) a recreation.
  const catalog = createCatalog(freeCatalogSource, patternsCatalogSource);
  for (const def of freeDefinitions) {
    if (def.hidden || def.category === "layout") continue;
    assert.ok(catalog.forComponent(def.id), `${def.id} appears in no catalog entry`);
  }
});

import { sanitizeEvents } from "../src/index.js";
test("analytics events keep only allow-listed names, keys and short values", () => {
  const out = sanitizeEvents([
    { name: "code_copied", props: { from: "export", email: "a@b.c", component: "x".repeat(80) } },
    { name: "project_state", props: { tree: "{}" } },
    { name: "component_remixed", props: { component: "button", property: "title", screens: 2.345 } },
    { name: "code_viewed", props: { kind: "<script>" } },
  ]);
  assert.deepEqual(out, [
    { name: "code_copied", props: { from: "export" } },
    { name: "component_remixed", props: { component: "button", property: "title", screens: 2.3 } },
    { name: "code_viewed", props: {} },
  ]);
  assert.equal(sanitizeEvents(Array.from({ length: 50 }, () => ({ name: "playground_opened" }))).length, 20);
  assert.deepEqual(sanitizeEvents("nope"), []);
});

test("an autosaved remix only comes back over the same build; a rebuilt entry drops it", async () => {
  const { createPersistence, buildFingerprint } = await import("../src/react/playground/persist.js");
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } };
  try {
    const persist = createPersistence("t");
    const base = { v: 1 as const, id: "p", name: "A", shell: "single" as const, updatedAt: 0, screens: [{ id: "s", name: "AView", root: { id: "r", component: "screen", props: {} } }] };
    const rebuilt = { ...base, screens: [{ ...base.screens[0], root: { ...base.screens[0].root, props: { title: "New" } } }] };
    persist.saveRemix("flows/a", { ...base, name: "Mine" }, buildFingerprint(base));
    persist.flush();
    assert.equal((persist.remix("flows/a", buildFingerprint(base)) as { name: string }).name, "Mine", "same build restores the remix");
    assert.equal(persist.remix("flows/a", buildFingerprint(rebuilt)), null, "a rebuilt entry ignores the old remix");
    assert.equal(persist.remix("flows/a", buildFingerprint(base)), null, "and the stale remix is gone");
    store.set("t:remix:flows/b", JSON.stringify(base));
    assert.equal(persist.remix("flows/b", buildFingerprint(base)), null, "remixes saved before fingerprints are dropped");
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});
