import assert from "node:assert/strict";
import { test } from "node:test";
import { FREE_LIMITS, generateProject, validateProject, type ScreenNode, type Theme } from "../src/index.js";
import { planList } from "../src/core/lists.js";
import { themeFromLook } from "../src/core/looks.js";
import { decodeStyle, encodeStyle, shuffleTheme } from "../src/core/shuffle.js";
import { assertWellFormedSwift, registry } from "./helpers.js";

// Style → Lists: runs of rows are found in any column and drawn as separate cards, one grouped
// card with hairlines, or plain rows with hairlines, the same way in the preview and the Swift.

let id = 0;
const nd = (component: string, props: Record<string, unknown> = {}, children?: ScreenNode[]): ScreenNode => ({ id: `n${++id}`, component, props: props as ScreenNode["props"], ...(children ? { children } : {}) });
const settings = (title: string) => nd("row", { icon: "bell", title, accessory: "chevron" });

test("a list is found, not declared: runs of rows, carded rows, a Group of rows, never inside a mixed card", () => {
  const a = settings("A"), b = settings("B"), c = settings("C");
  const shape = (plan: ReturnType<typeof planList>) => plan?.parts.map((p) => ("rows" in p ? p.rows.map((r) => r.id) : p.node.component));
  // A heading, then three rows with dividers between: one run, the dividers fold into it.
  const col = nd("vstack", { spacing: 12 }, [nd("text", { text: "Recent" }), a, nd("divider"), b, nd("divider"), c]);
  const plan = planList(col, registry, "grouped")!;
  assert.equal(plan.whole, false);
  assert.deepEqual(shape(plan), ["text", [a.id, b.id, c.id]]);
  // No style, no change.
  assert.equal(planList(col, registry, null), null);
  // A lone row follows the style too, so every row on a screen matches.
  const lone = settings("x");
  assert.deepEqual(shape(planList(nd("vstack", {}, [nd("text"), lone, nd("text")]), registry, "cards")), ["text", [lone.id], "text"]);
  // A card Group of rows is the list itself, even with one row.
  const one = nd("vstack", { style: "card", padding: 16, radius: 16 }, [settings("Only")]);
  assert.equal(planList(one, registry, "plain")!.whole, true);
  // Rows each on their own card merge into one list: the cards give way.
  const r1 = settings("1"), r2 = settings("2");
  const carded = nd("vstack", { spacing: 12 }, [nd("vstack", { style: "card", padding: 16 }, [r1]), nd("vstack", { style: "card", padding: 16 }, [r2])]);
  assert.deepEqual(shape(planList(carded, registry, "grouped")), [[r1.id, r2.id]]);
  // A card with a heading and rows keeps its layout: no card in a card.
  assert.equal(planList(nd("vstack", { style: "card" }, [nd("text"), settings("x"), settings("y")]), registry, "grouped"), null);
  // Rows split by something else are two runs; a divider after the last row stays.
  const split = nd("vstack", {}, [settings("1"), settings("2"), nd("spacer"), settings("3"), settings("4"), nd("divider")]);
  assert.deepEqual(planList(split, registry, "cards")!.parts.map((p) => ("rows" in p ? p.rows.length : p.node.component)), [2, "spacer", 2, "divider"]);
  // A panel without corners is a ground rows sit on; one with corners is a card.
  assert.ok(planList(nd("tint-panel", { radius: 0 }, [nd("text"), settings("p")]), registry, "plain"));
  assert.equal(planList(nd("tint-panel", { radius: 24 }, [nd("text"), settings("p")]), registry, "plain"), null);
});

const project = (lists: Theme["lists"]) => ({
  v: 1, id: "p", name: "Lists", shell: "single", updatedAt: 0,
  theme: { ...themeFromLook("pieces"), ...(lists ? { lists } : {}) },
  screens: [{ id: "s", name: "HomeView", root: nd("screen", { title: "" }, [
    nd("text", { text: "Settings" }),
    nd("vstack", { spacing: 0, style: "card", padding: 16, radius: 16 }, [settings("Notifications"), nd("divider"), settings("Privacy"), nd("divider"), settings("Sounds")]),
  ]) }],
});

test("each list style reaches the Swift", () => {
  const home = (lists: Theme["lists"]) => {
    const files = generateProject(validateProject(project(lists), registry, FREE_LIMITS).value, registry).files;
    for (const f of files) if (f.path.endsWith(".swift")) assertWellFormedSwift(f.content, f.path);
    return files.find((f) => f.path.endsWith("HomeView.swift"))!.content;
  };
  const own = home(undefined);
  assert.equal((own.match(/Divider\(\)/g) ?? []).length, 2, "as built: the Group's own dividers");
  const grouped = home("grouped");
  assert.equal((grouped.match(/themeCard\(cornerRadius: 16\)/g) ?? []).length, 1, "grouped: one card");
  assert.equal((grouped.match(/Divider\(\)/g) ?? []).length, 2, "grouped: hairlines between");
  const cards = home("cards");
  assert.equal((cards.match(/themeCard\(cornerRadius: 16\)/g) ?? []).length, 3, "cards: one per row");
  assert.doesNotMatch(cards, /Divider\(\)/, "cards: no hairlines");
  const plain = home("plain");
  assert.doesNotMatch(plain, /themeCard/, "plain: no card");
  assert.equal((plain.match(/Divider\(\)/g) ?? []).length, 2);
});

test("lists survive validation, the style code (older codes still paste) and Shuffle's locks", () => {
  for (const lists of ["cards", "grouped", "plain"] as const) {
    assert.equal(validateProject(project(lists), registry, FREE_LIMITS).value.theme!.lists, lists);
    assert.equal(decodeStyle(encodeStyle({ ...themeFromLook("pieces"), lists }))!.lists, lists);
  }
  assert.equal(decodeStyle(encodeStyle(themeFromLook("pieces")))!.lists, undefined, "the app's own lists");
  // A code from before Lists existed (24 choices) still decodes.
  assert.ok(decodeStyle("SP2-000100000050000000002000220000"));
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(shuffleTheme(i * 7919 + 3, undefined).theme.lists ?? "own");
  assert.deepEqual([...seen].sort(), ["cards", "grouped", "own", "plain"]);
  const base = { ...shuffleTheme(5, undefined).theme, lists: "plain" as const };
  for (let i = 0; i < 20; i++) assert.equal(shuffleTheme(i + 100, base, new Set(["shape"] as const)).theme.lists, "plain", "a kept Shape keeps its lists");
});
