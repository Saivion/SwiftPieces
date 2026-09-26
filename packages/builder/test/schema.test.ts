import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { colors, concepts, createRegistry, defaultProps, freeDefinitions, freePieces, generateScreen, icons, newId, playgroundComponentId, playgroundPieceNames, primitives } from "../src/index.js";
import { assertWellFormedSwift, registry } from "./helpers.js";

test("definition ids are unique and the registry refuses duplicates", () => {
  const ids = freeDefinitions.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => createRegistry(primitives, [primitives[1]]), /Duplicate/);
});

test("every property has a valid default and a valid `when` reference", () => {
  const colorIds = new Set(colors.map((c) => c.id));
  const iconIds = new Set(icons.map((i) => i.id));
  for (const def of freeDefinitions) {
    const propIds = new Set(def.properties.map((p) => p.id));
    assert.equal(propIds.size, def.properties.length, `${def.id}: duplicate property ids`);
    for (const p of def.properties) {
      const where = `${def.id}.${p.id}`;
      if (p.type === "select") assert.ok(p.options?.some((o) => o.value === p.defaultValue), `${where}: default not an option`);
      if (p.type === "color") assert.ok(colorIds.has(String(p.defaultValue)) || p.options?.some((o) => o.value === p.defaultValue), `${where}: unknown color`);
      if (p.type === "icon") assert.ok(iconIds.has(String(p.defaultValue)), `${where}: unknown icon`);
      if (p.type === "number" || p.type === "spacing") {
        assert.equal(typeof p.defaultValue, "number", where);
        assert.ok((p.min ?? -Infinity) <= (p.defaultValue as number) && (p.defaultValue as number) <= (p.max ?? Infinity), `${where}: default out of range`);
      }
      if (p.type === "boolean") assert.equal(typeof p.defaultValue, "boolean", where);
      if (p.type === "text") assert.equal(typeof p.defaultValue, "string", where);
      if (p.when) assert.ok(propIds.has(p.when.prop), `${where}: when refers to missing ${p.when.prop}`);
    }
    for (const c of def.concepts ?? []) assert.ok(concepts[c], `${def.id}: unknown concept ${c}`);
    for (const v of def.variants ?? []) for (const k of Object.keys(v.props)) assert.ok(propIds.has(k), `${def.id} variant ${v.id}: unknown prop ${k}`);
  }
});

test("every definition emits well-formed SwiftUI with its defaults", () => {
  for (const def of freeDefinitions) {
    if (def.id === "screen") continue;
    const node = { id: "x", component: def.id, props: defaultProps(def), ...(def.container ? { children: [] } : {}) };
    const screen = { id: "s", name: "PreviewView", root: { id: "r", component: "screen", props: defaultProps(registry.get("screen")!), children: [node] } };
    const out = generateScreen(screen, registry);
    assertWellFormedSwift(out.code, def.id);
    assert.ok(out.ranges.x, `${def.id}: no line range recorded`);
    if (def.source) assert.deepEqual(out.pieces, [def.source], `${def.id}: piece not recorded`);
  }
});

test("free pieces point at real registry entries and docs pages", () => {
  const indexPath = join(import.meta.dirname, "..", "..", "..", "registry", "__registry__", "index.json");
  if (!existsSync(indexPath)) return; // Running outside the SwiftPieces repo.
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as Array<{ name: string; slug: string; category: string }>;
  const byName = new Map(index.map((e) => [e.name, e]));
  for (const def of freePieces) {
    const entry = byName.get(def.source!.name);
    assert.ok(entry, `${def.id}: ${def.source!.name} is not in the free registry`);
    assert.equal(def.docs, `/docs/components/${entry!.category}/${entry!.slug}`, `${def.id}: docs path`);
    assert.equal(def.availability, "free");
  }
  assert.equal(playgroundComponentId("ElasticButton"), "elastic-button");
  assert.equal(playgroundComponentId("NotAPiece"), null);
  assert.equal(playgroundPieceNames.length, freePieces.length);
});

test("new ids are unique", () => {
  const ids = new Set(Array.from({ length: 2000 }, () => newId()));
  assert.equal(ids.size, 2000);
});

test("no Swift import line is written literally into the bundle (deploy audits reject it)", async () => {
  const { readdirSync } = await import("node:fs");
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  for (const file of walk(join(import.meta.dirname, "..", "src"))) {
    const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /import SwiftUI/, file);
  }
});
