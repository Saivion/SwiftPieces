import assert from "node:assert/strict";
import { test } from "node:test";
import { createCatalog, FREE_LIMITS, generateProject, validateProject, type ScreenNode } from "../src/index.js";
import { patternsCatalogSource } from "../src/definitions/catalog/index.js";
import { createPersistence } from "../src/react/playground/persist.js";
import { createPlayStore } from "../src/react/playground/store.js";
import { countNodes } from "../src/core/tree.js";
import { assertWellFormedSwift, registry } from "./helpers.js";

// Layout editing inside a screen: remove, move, duplicate and insert, each one undo step, and the
// project stays valid and generates well-formed SwiftUI afterwards.

const catalog = createCatalog(patternsCatalogSource);
const entry = catalog.entries.find((e) => e.availability === "free" && (e.steps?.length ?? 0) > 0)!;

async function open() {
  const store = createPlayStore({}, { registry, limits: FREE_LIMITS, catalog, persist: createPersistence("test-layout"), track: () => {} });
  await store.open(entry);
  assert.equal(store.getState().status, "ready");
  return store;
}
const firstScreen = (store: Awaited<ReturnType<typeof open>>) => store.getState().project!.screens[0];
const kids = (n: ScreenNode) => (n.children ?? []).map((c) => c.id);

test("remove, move, duplicate and insert reshape a screen and undo one step at a time", async () => {
  const store = await open();
  const root = firstScreen(store).root;
  assert.ok((root.children?.length ?? 0) >= 2, "the screen has at least two components");
  const [a, b] = kids(root);

  store.moveNode(b, -1);
  assert.deepEqual(kids(firstScreen(store).root).slice(0, 2), [b, a]);

  store.removeNode(a);
  assert.ok(!kids(firstScreen(store).root).includes(a));

  store.duplicateNode(b);
  const copy = store.getState().selected!.nodeId;
  assert.notEqual(copy, b);
  assert.equal(kids(firstScreen(store).root).indexOf(copy), kids(firstScreen(store).root).indexOf(b) + 1, "the copy lands right after");

  store.insertComponent(firstScreen(store).root.id, "text");
  const added = store.getState().selected!.nodeId;
  assert.equal(kids(firstScreen(store).root).at(-1), added, "added at the end of the screen");

  // Still a valid project that emits well-formed SwiftUI.
  const project = store.getState().project!;
  assert.equal(validateProject(project, registry, FREE_LIMITS).issues.length, 0);
  for (const file of generateProject(project, registry).files) if (file.path.endsWith(".swift")) assertWellFormedSwift(file.content, file.path);

  // Four edits, four undos, back to the opened screen.
  for (let i = 0; i < 4; i++) store.undo();
  assert.deepEqual(kids(firstScreen(store).root), kids(root));
});

test("the screen itself can't be removed, and adding respects the tier's per-screen cap", async () => {
  const store = await open();
  const root = firstScreen(store).root;
  store.removeNode(root.id);
  assert.equal(firstScreen(store).root, root);

  while (countNodes(firstScreen(store).root) < FREE_LIMITS.maxNodesPerScreen) store.insertComponent(root.id, "divider");
  const full = firstScreen(store).root;
  store.insertComponent(root.id, "divider");
  assert.equal(firstScreen(store).root, full, "no insert past the cap");
  assert.match(store.getState().notice?.text ?? "", /up to 40/);
});

test("adding a component the app already uses copies the app's version, with fresh ids", async () => {
  const store = await open();
  const root = firstScreen(store).root;
  const source = root.children!.find((c) => c.component !== "screen")!;
  store.insertComponent(root.id, source.component);
  const added = store.getState().selected!.nodeId;
  const node = firstScreen(store).root.children!.find((c) => c.id === added)!;
  assert.notEqual(node.id, source.id);
  assert.deepEqual(node.props, source.props);
});

test("a drag's drop moves a component to an index among its siblings, and a no-op drop leaves no undo step", async () => {
  const store = await open();
  const root = firstScreen(store).root;
  const ids = kids(root);
  assert.ok(ids.length >= 3, "the screen has at least three components");
  const [first] = ids;

  // Dropped where it already is: nothing changes, nothing to undo.
  const undoBefore = store.canUndo();
  store.moveNodeTo(first, root.id, 0);
  assert.equal(firstScreen(store).root, root);
  assert.equal(store.canUndo(), undoBefore);

  // Dropped at the end (the index counts its siblings without it).
  store.moveNodeTo(first, root.id, ids.length - 1);
  assert.deepEqual(kids(firstScreen(store).root), [...ids.slice(1), first]);
  store.undo();
  assert.deepEqual(kids(firstScreen(store).root), ids);

  // The screen itself never moves.
  store.moveNodeTo(root.id, root.id, 1);
  assert.deepEqual(kids(firstScreen(store).root), ids);
});
