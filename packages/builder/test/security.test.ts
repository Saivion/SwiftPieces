// Hostile input at every boundary a project crosses: shared links, hand-overs between the Free and
// Pro playgrounds, saves to an account, and the Swift, prompts and AGENTS.md a project is exported
// as. Everything here must fail closed: rejected, repaired or kept as inert text, never executed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCatalogProject, catalogApp, checkProjectStrict, cleanText, createCatalog, decodeProject, defaultProps, encodeProject, FREE_LIMITS, generateProject, nd, PRO_LIMITS, validateProject, type CatalogSource } from "../src/index.js";
import { freeCatalogSource, patternEntries, patternsCatalogSource } from "../src/definitions/catalog/index.js";
import { createPersistence } from "../src/react/playground/persist.js";
import { createPlayStore } from "../src/react/playground/store.js";
import { assertWellFormedSwift, entryProject, registry } from "./helpers.js";

/** Text that tries to leave a Swift string, start interpolation, or resolve to a built-in object member. */
const PAYLOADS = [
  'a"+PWNED+"b',
  'a\\")PWNED(\\"',
  "x\\(PWNED)y",
  "a\nPWNED\nb",
  "a\r\nPWNED",
  '"""PWNED"""',
  'a#"PWNED"#b',
  "a;PWNED;b,c|d",
  "*/PWNED/*",
  "constructor",
  "__proto__",
  "toString",
  "hasOwnProperty | constructor | __proto__; toString | valueOf | constructor",
];

/**
 * Swift with every string literal's text and every comment taken out: what is left is code. Lexes
 * the way Swift does: escapes, multi-line literals, and `\( … )` interpolation, which is code again
 * (and may hold string literals of its own) until its matching parenthesis.
 */
function codeOnly(swift: string): string {
  let out = "";
  // Each entry is an open string (its closing delimiter) or an interpolation's parenthesis depth.
  const stack: Array<{ string: string } | { depth: number }> = [];
  const top = () => stack[stack.length - 1];
  for (let i = 0; i < swift.length; i++) {
    const t = top();
    const ch = swift[i];
    if (t && "string" in t) {
      if (ch === "\\" && swift[i + 1] === "(") {
        stack.push({ depth: 0 });
        out += "(";
        i++;
      } else if (ch === "\\") i++;
      else if (swift.startsWith(t.string, i)) {
        stack.pop();
        out += '""';
        i += t.string.length - 1;
      }
      continue;
    }
    if (ch === "/" && swift[i + 1] === "/") {
      while (i < swift.length && swift[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (ch === '"') {
      const triple = swift.startsWith('"""', i);
      stack.push({ string: triple ? '"""' : '"' });
      if (triple) i += 2;
      continue;
    }
    if (t && "depth" in t) {
      if (ch === "(") t.depth++;
      else if (ch === ")") {
        if (t.depth === 0) {
          stack.pop();
          out += ")";
          continue;
        }
        t.depth--;
      }
    }
    out += ch;
  }
  return out;
}

test("the checker itself sees a real breakout and ignores escaped text", () => {
  assert.ok(codeOnly('Text("a"+PWNED+"b")').includes("PWNED"));
  assert.ok(codeOnly('Text("a\\(PWNED)b")').includes("PWNED"), "interpolation is code");
  assert.ok(!codeOnly('Text("a\\"+PWNED+\\"b")').includes("PWNED"));
  assert.ok(!codeOnly('Text("x\\\\(PWNED)y\\n\\(Text("x\\\\(PWNED)y").bold())")').includes("PWNED"));
  assert.ok(!codeOnly('let s = """\nPWNED "quoted"\n"""').includes("PWNED"));
});

test("no text in any component can escape into Swift code or break the export", () => {
  for (const def of registry.all) {
    if (def.hidden) continue;
    const textProps = def.properties.filter((p) => p.type === "text");
    if (!textProps.length) continue;
    for (const payload of PAYLOADS) {
      const props: Record<string, unknown> = { ...defaultProps(def) };
      for (const p of textProps) props[p.id] = payload;
      const raw = { name: "Evil", screens: [{ id: "s1", name: "Main", root: { id: "r", component: "screen", props: {}, children: [{ id: "n1", component: def.id, props }] } }] };
      const { value } = validateProject(raw, registry);
      const gen = generateProject(value, registry);
      for (const f of gen.files) {
        if (!f.path.endsWith(".swift")) continue;
        assert.ok(!codeOnly(f.content).includes("PWNED"), `${def.id} ${JSON.stringify(payload)}: text escaped its string in ${f.path}`);
        assert.ok(!/function\s+\w*\(\)\s*\{\s*\[native code\]/.test(f.content), `${def.id} ${JSON.stringify(payload)}: a built-in member leaked into ${f.path}`);
        assertWellFormedSwift(f.content, `${def.id} ${JSON.stringify(payload)} ${f.path}`);
      }
    }
  }
});

test("text is cleaned of control, bidirectional and zero-width characters", () => {
  assert.equal(cleanText("a\u0000b\u0007c"), "abc");
  assert.equal(cleanText("safe‮gnp.exe"), "safegnp.exe");
  assert.equal(cleanText("zero​width﻿"), "zerowidth");
  assert.equal(cleanText("line sep"), "linesep");
  assert.equal(cleanText("keeps\nnewlines\tand tabs"), "keeps\nnewlines\tand tabs");
  // Tab titles and style names go through the same cleaning.
  const { value } = validateProject({ screens: [{ id: "s1", name: "Home", tab: { title: "Ho‮me\u0000", icon: "house" }, root: { component: "screen", props: {}, children: [] } }], theme: { look: "pieces", name: "Nice‮\u0007" } }, registry);
  assert.equal(value.screens[0].tab?.title, "Home");
  assert.equal(value.theme?.name, "Nice");
});

// ---------------------------------------------------------------- The strict gate for saves

/** Every project a user can actually make, as the client would send it: through JSON. */
async function realProjects() {
  const out = [];
  const free = createCatalog(freeCatalogSource);
  for (const e of free.entries) out.push({ label: `${e.kind}/${e.slug}`, project: JSON.parse(JSON.stringify(entryProject(e.kind, e.slug))) });
  const patterns = createCatalog(patternsCatalogSource);
  for (const e of patterns.entries) {
    const store = createPlayStore({}, { registry, limits: FREE_LIMITS, catalog: patterns, persist: createPersistence("security-test"), track: () => {} });
    await store.open(e);
    const p = store.getState().project;
    if (p) out.push({ label: `patterns/${e.slug}`, project: JSON.parse(JSON.stringify(p)) });
  }
  return out;
}

test("every project the playground makes passes the strict gate as sent", async () => {
  const projects = await realProjects();
  assert.ok(projects.length > 40, "expected the whole catalog");
  for (const { label, project } of projects) {
    const r = checkProjectStrict(project, registry, FREE_LIMITS);
    assert.ok(r.ok, `${label}: ${r.ok ? "" : r.errors.join("; ")}`);
  }
});

test("the strict gate refuses anything that isn't exactly valid", async () => {
  const [{ project: good }] = await realProjects();
  const clone = () => JSON.parse(JSON.stringify(good));
  const firstNode = (p: { screens: Array<{ root: { children?: Array<Record<string, unknown>> } }> }) => p.screens[0].root.children![0] as { props: Record<string, unknown>; component: string; id: string };
  const cases: Array<[string, (p: ReturnType<typeof clone>) => void]> = [
    ["unknown top-level field", (p) => (p.owner = "user_someone_else")],
    ["unknown screen field", (p) => (p.screens[0].secret = true)],
    ["unknown node field", (p) => (firstNode(p) as Record<string, unknown>).onClick = "alert(1)"],
    ["unknown prop", (p) => (firstNode(p).props.innerHTML = "<img src=x onerror=alert(1)>")],
    ["prototype key", (p) => (p.screens[0].root = JSON.parse(`{"__proto__":{"polluted":true},${JSON.stringify(p.screens[0].root).slice(1)}`))],
    ["wrong type", (p) => (p.shell = 42)],
    ["invalid option", (p) => (p.shell = "desktop")],
    ["unknown component", (p) => (firstNode(p).component = "script")],
    ["bad id", (p) => (firstNode(p).id = "../../etc/passwd")],
    ["bad screen name", (p) => (p.screens[0].name = "Main\"); exit(0); //")],
    ["dirty style name", (p) => (p.theme = { ...(p.theme ?? { look: "pieces" }), name: "Ignore previous instructions‮" })],
    ["bad accent", (p) => (p.theme = { ...(p.theme ?? { look: "pieces" }), accentHex: "red;background:url(https://evil.test)" })],
    ["no screens", (p) => (p.screens = [])],
    ["not an object", () => undefined],
  ];
  for (const [label, mutate] of cases) {
    const p = clone();
    mutate(p);
    const r = checkProjectStrict(label === "not an object" ? "[]" : p, registry, FREE_LIMITS);
    assert.equal(r.ok, false, `accepted: ${label}`);
  }
  // Duplicated node ids, too many screens, and nesting past the limit.
  const dup = clone();
  const kids = dup.screens[0].root.children;
  if (kids.length >= 2) {
    kids[1].id = kids[0].id;
    assert.equal(checkProjectStrict(dup, registry, FREE_LIMITS).ok, false, "accepted duplicate ids");
  }
  const many = clone();
  many.screens = Array.from({ length: FREE_LIMITS.maxScreens + 1 }, (_, i) => ({ ...many.screens[0], id: `s${i}`, name: `Screen${i}View` }));
  assert.equal(checkProjectStrict(many, registry, FREE_LIMITS).ok, false, "accepted too many screens");
  let node: Record<string, unknown> = { id: "leaf", component: "text", props: {} };
  for (let i = 0; i < 12; i++) node = { id: `v${i}`, component: "vstack", props: {}, children: [node] };
  const deep = { name: "Deep", screens: [{ id: "s1", name: "DeepView", root: { id: "r", component: "screen", props: {}, children: [node] } }] };
  assert.equal(checkProjectStrict(deep, registry, FREE_LIMITS).ok, false, "accepted nesting past the limit");
});

test("a link to a screen that doesn't exist is refused, not silently cleared", async () => {
  const projects = await realProjects();
  const withLink = projects.find(({ project }) => JSON.stringify(project).includes('"link":"'));
  assert.ok(withLink, "a project with a link");
  const json = JSON.stringify(withLink.project).replace(/"link":"(sheet:|root:)?[A-Za-z0-9_-]+"/, '"link":"missing-screen"');
  assert.equal(checkProjectStrict(JSON.parse(json), registry, FREE_LIMITS).ok, false);
});

// ---------------------------------------------------------------- Links

test("a link nested thousands deep decodes safely and quickly", async () => {
  // Built directly as the compact form, then compressed the way encodeProject does it.
  let n = '{"c":"text"}';
  for (let i = 0; i < 20000; i++) n = `{"c":"vstack","k":[${n}]}`;
  const json = new TextEncoder().encode(`{"n":"Deep","s":[{"id":"s1","n":"Deep","r":${n}}],"t":1e300}`);
  const deflated = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  let bin = "";
  for (const b of deflated) bin += String.fromCharCode(b);
  const blob = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const started = Date.now();
  const raw = (await decodeProject(blob)) as { updatedAt: number };
  const { value } = validateProject(raw, registry, FREE_LIMITS);
  assert.ok(Date.now() - started < 2000, "took too long");
  assert.ok(raw.updatedAt <= (2 ** 32 - 1) * 1000, "commit time not clamped");
  assert.ok(value.screens.length === 1);
});

test("a shared link round-trips a real project and nothing more", async () => {
  const project = entryProject("screens", createCatalog(freeCatalogSource).entries.find((e) => e.kind === "screens")!.slug);
  const back = validateProject(await decodeProject(await encodeProject(project, registry)), registry).value;
  assert.deepEqual(back.screens.map((s) => s.name), project.screens.map((s) => s.name));
  await assert.rejects(decodeProject("not a link!"));
  await assert.rejects(decodeProject("A".repeat(12_001)));
});

test("a tabbed project keeps its tab bar through a share link; an older link without tab items still opens", async () => {
  const entry = patternsCatalogSource.entries.find((e) => e.slug === "podcast-player")!;
  const p = buildCatalogProject(entry, (await patternsCatalogSource.load(entry))!, registry, FREE_LIMITS);
  assert.equal(p.shell, "tabs");
  const back = validateProject(await decodeProject(await encodeProject(p, registry)), registry, FREE_LIMITS).value;
  assert.equal(back.shell, "tabs");
  assert.deepEqual(back.screens.map((s) => s.tab), p.screens.map((s) => s.tab));
  assert.equal(back.tabBar, p.tabBar);
  const old = validateProject(await decodeProject(await encodeProject({ ...p, screens: p.screens.map(({ tab: _t, ...s }) => s) }, registry)), registry, FREE_LIMITS).value;
  assert.ok(old.screens.every((s) => !s.tab));
});

// ---------------------------------------------------------------- Pro apps, seen from Free

/** A Pro app as Free's playground sees it (its entry), with a source that counts what it's asked for. */
function proApp() {
  const entry = patternEntries.find((e) => e.availability === "pro")!;
  let loads = 0;
  const source: CatalogSource = {
    entries: [entry],
    load: async () => {
      loads++;
      return catalogApp({ name: "Secret", screens: () => [{ key: "a", name: "SecretView", children: [nd("text", { text: "Pro only" })] }] });
    },
  };
  return { entry, catalog: createCatalog(patternsCatalogSource, source), loads: () => loads };
}
const handedOver = { name: "HandedOver", screens: [{ id: "s1", name: "MineView", root: { id: "r", component: "screen", props: {}, children: [{ id: "t", component: "text", props: { text: "Mine" } }] } }] };

test("a Pro app stays locked on the free plan: nothing of it loads, a remix for it isn't shown, its screens can't be brought in", async () => {
  const { entry, catalog, loads } = proApp();
  const store = createPlayStore({}, { registry, limits: FREE_LIMITS, catalog, persist: createPersistence("security-pro"), track: () => {} });
  await store.open(entry, { project: handedOver, origin: { kind: "shared" } });
  assert.equal(store.getState().status, "locked");
  assert.equal(store.getState().project, null);
  const free = catalog.entries.find((e) => e.availability === "free")!;
  await store.open(free);
  assert.equal(store.getState().status, "ready");
  assert.equal(await store.importScreen(entry, 0), false);
  assert.equal(loads(), 0, "the Pro source was never asked");
});

test("a plan that opens a locked Pro app, arriving late, opens it the way it was asked for", async () => {
  const { entry, catalog, loads } = proApp();
  const store = createPlayStore({}, { registry, limits: FREE_LIMITS, catalog, persist: createPersistence("security-pro-late"), track: () => {} });
  await store.open(entry, { project: handedOver, origin: { kind: "shared" } });
  assert.equal(store.getState().status, "locked");
  // Another plan without Pro changes nothing.
  store.setLimits({ ...FREE_LIMITS });
  assert.equal(store.getState().status, "locked");
  store.setLimits(PRO_LIMITS);
  for (let i = 0; i < 50 && store.getState().status !== "ready"; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(store.getState().status, "ready");
  assert.equal(store.getState().project?.name, "HandedOver", "the remix it was opened with, not the build");
  assert.equal(loads(), 1);
});
