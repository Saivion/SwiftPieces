import assert from "node:assert/strict";
import { test } from "node:test";
import { FREE_LIMITS, generateProject, validateProject, type Theme } from "../src/index.js";
import { resolveTheme, themeFromLook } from "../src/core/looks.js";
import { decodeStyle, encodeStyle, shuffleTheme } from "../src/core/shuffle.js";
import { assertWellFormedSwift, registry } from "./helpers.js";

// The later Style options: contrast, greys, the dark ground, numbers, title hierarchy, buttons,
// entrance, the mascot and the mesh backdrop. Each survives validation and the style code, and
// reaches the exported Swift.

const all: Theme = {
  ...themeFromLook("candy"),
  contrast: "high",
  neutrals: "warm",
  darkGround: "black",
  numbers: "tabular",
  hierarchy: "dramatic",
  buttons: "outline",
  entrance: "rise",
  mascot: "hidden",
  backdrop: "mesh",
};

const project = (theme: Theme) => ({
  v: 1,
  id: "p",
  name: "Styled",
  shell: "single",
  updatedAt: 0,
  theme,
  screens: [{ id: "s", name: "HomeView", root: { id: "r", component: "screen", props: { title: "Home" }, children: [{ id: "b", component: "elastic-button", props: { title: "Start", style: "signal" } }, { id: "m", component: "mascot", props: {} }] } }],
});

test("the later options survive validation and round-trip through the style code; SP1 codes still paste", () => {
  const v = validateProject(project(all), registry, FREE_LIMITS).value.theme!;
  for (const k of ["contrast", "neutrals", "darkGround", "numbers", "hierarchy", "buttons", "entrance", "mascot", "backdrop"] as const) assert.equal(v[k], all[k], k);
  const back = decodeStyle(encodeStyle(all))!;
  for (const k of ["contrast", "neutrals", "darkGround", "numbers", "hierarchy", "buttons", "entrance", "mascot", "backdrop"] as const) assert.equal(back[k], all[k], `code: ${k}`);
  assert.match(encodeStyle(all), /^SP2-/);
  assert.ok(decodeStyle("SP1-0500040011100104032247C8A9"), "an SP1 code still decodes");
  for (let i = 0; i < 30; i++) {
    const t = shuffleTheme(i * 104729 + 7, undefined).theme;
    const again = decodeStyle(encodeStyle(t))!;
    assert.equal(again.buttons ?? "solid", t.buttons ?? "solid");
    assert.equal(again.hierarchy ?? "balanced", t.hierarchy ?? "balanced");
  }
});

test("they reach the Swift: tabular digits, the entrance, outline buttons, a hidden mascot, the mesh, title scale, darker grounds", () => {
  const p = validateProject(project(all), registry, FREE_LIMITS).value;
  const files = generateProject(p, registry).files;
  const text = files.map((f) => f.content).join("\n");
  for (const f of files) if (f.path.endsWith(".swift")) assertWellFormedSwift(f.content, f.path);
  assert.match(text, /monospacedDigit\(\)/);
  assert.match(text, /\.themeEntrance\(\)/);
  assert.match(text, /struct ThemeEntrance/);
  assert.match(text, /strokeBorder\(Theme\.accent, lineWidth: 1\.5\)/);
  assert.match(text, /MeshGradient/);
  assert.match(text, /static let titleScale: CGFloat = 1\.18/);
  const home = files.find((f) => f.path.endsWith("HomeView.swift"))!.content;
  assert.doesNotMatch(home, /Mascot\(/, "a hidden mascot writes nothing");
  // True black in dark mode; high contrast lifts the surface.
  const r = resolveTheme(all);
  assert.equal(r.background.dark, "#000000");
  assert.notEqual(r.surface.light, resolveTheme(themeFromLook("candy")).surface.light);
});

test("headers, button size, icon size and the tab bar reach the Swift and the code", () => {
  const theme: Theme = { ...themeFromLook("pieces"), headers: "centered", buttonSize: "large", iconScale: "small", tabStyle: "glass" };
  const back = decodeStyle(encodeStyle(theme))!;
  for (const k of ["headers", "buttonSize", "iconScale", "tabStyle"] as const) assert.equal(back[k], theme[k], `code: ${k}`);
  // A code from before these existed still decodes.
  assert.ok(decodeStyle("SP2-0001000000500000000020002200"));
  const tabs = {
    v: 1, id: "p", name: "Tabs", shell: "tabs", tabBar: "dock", updatedAt: 0, theme,
    screens: [
      { id: "a", name: "HomeView", tab: { title: "Home", icon: "house" }, root: { id: "ra", component: "screen", props: {}, children: [{ id: "h", component: "screen-header", props: { title: "Hello", emphasis: "there", trailing: "icon" } }, { id: "b", component: "elastic-button", props: { title: "Go", style: "signal" } }] } },
      { id: "b2", name: "MoreView", tab: { title: "More", icon: "star" }, root: { id: "rb", component: "screen", props: {} } },
    ],
  };
  const p = validateProject(tabs, registry, FREE_LIMITS).value;
  const out = generateProject(p, registry);
  const text = out.files.map((f) => f.content).join("\n");
  assert.match(text, /usesGlass = true/, "the glass dock");
  assert.match(text, /imageScale\(\.small\)/);
  assert.match(text, /style\.height = 64/, "large buttons");
  assert.match(text, /ZStack\(alignment: \.topTrailing\)/, "a centered header keeps its button in the corner");
  assert.ok(out.pieces.some((x) => x.name === "FloatingDock"));
  // System: the plain TabView, no dock.
  const sys = generateProject(validateProject({ ...tabs, theme: { ...theme, tabStyle: "system" } }, registry, FREE_LIMITS).value, registry);
  assert.ok(!sys.pieces.some((x) => x.name === "FloatingDock"));
  assert.match(sys.files.find((f) => f.path === "ContentView.swift")!.content, /tabItem/);
});

test("shuffle never serves a near-rerun of the last few styles, and locked sections still hold", async () => {
  const { styleDistance, newSeed } = await import("../src/core/shuffle.js");
  const seen: Theme[] = [];
  let near = 0;
  let cur: Theme | undefined;
  for (let i = 0; i < 300; i++) {
    const t = shuffleTheme(newSeed(), cur, new Set(), seen.slice(-8)).theme;
    if (seen.slice(-8).some((s) => styleDistance(t, s) <= 6)) near++;
    if (cur) assert.notEqual(t.look, cur.look, "a new preset every time");
    seen.push(t);
    cur = t;
  }
  assert.ok(near <= 6, `near-reruns: ${near} of 300`);
  const base = shuffleTheme(1, undefined).theme;
  const kept = shuffleTheme(2, base, new Set(["colour", "shape"] as const), [base]).theme;
  for (const k of ["look", "accent", "corners", "cards", "buttons"] as const) assert.equal(kept[k], base[k], `locked ${k}`);
});
