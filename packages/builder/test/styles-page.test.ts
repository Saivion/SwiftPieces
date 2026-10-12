import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ACCENT_SLOTS, STYLE_DEFAULTS, STYLE_FIELDS, STYLE_OPTIONS, STYLE_PRESETS, accentRow, decodeStyle, editTheme, encodeStyle, looks, moods,
  presetColors, presetSelected, shuffleTheme, stylePatch, styleSwift, styleValue, themeFromLook, type StyleOptionKey, type Theme,
} from "../src/index.js";
import { assertWellFormedSwift } from "./helpers.js";

// The choices a style is made from (core/style-options.ts), shared by the Playground's Style tab and
// the Styles page: every choice is a real value, defaults are left out, edits land the way the Style
// tab makes them, and every style either surface makes survives its code and becomes Swift.

test("every choice list holds its default, and the defaults are what a style leaves out", () => {
  for (const key of Object.keys(STYLE_OPTIONS) as StyleOptionKey[]) {
    const values = STYLE_OPTIONS[key].map((o) => o[0] as string);
    assert.ok(values.includes(STYLE_DEFAULTS[key]), `${key}: ${STYLE_DEFAULTS[key]} isn't a choice`);
    assert.equal(new Set(values).size, values.length, `${key}: a value repeats`);
  }
  for (const f of STYLE_FIELDS) assert.ok(STYLE_OPTIONS[f.key], `${f.key} has no choices`);
  // An optional field set back to its default is taken out; a required one is always written.
  assert.deepEqual(stylePatch("cards", "flat"), { cards: undefined });
  assert.deepEqual(stylePatch("lists", "own"), { lists: undefined });
  assert.deepEqual(stylePatch("cards", "glass"), { cards: "glass" });
  assert.deepEqual(stylePatch("density", "regular"), { density: "regular" });
  assert.equal(styleValue(themeFromLook("pieces"), "backdrop"), "none");
});

test("a hand edit drops the shuffled name, and a colour edit drops a screenshot's exact colours", () => {
  const named: Theme = { ...themeFromLook("studio"), name: "Cobalt Terminal", custom: { mode: "dark", ground: "#101010" } };
  const shaped = editTheme(named, { corners: "round" });
  assert.equal(shaped.name, undefined);
  assert.ok(shaped.custom, "a shape edit keeps the screenshot's colours");
  const coloured = editTheme(named, { contrast: "high" });
  assert.equal(coloured.custom, undefined);
  assert.equal(coloured.contrast, "high");
  assert.equal("cards" in editTheme({ ...named, cards: "glass" }, { cards: undefined }), false);
});

test("every single choice, on every look, survives the style code", () => {
  for (const look of looks) {
    for (const key of Object.keys(STYLE_OPTIONS) as StyleOptionKey[]) {
      for (const [value] of STYLE_OPTIONS[key] as Array<[string]>) {
        const t = editTheme(themeFromLook(look.id), stylePatch(key, value));
        const back = decodeStyle(encodeStyle(t));
        assert.ok(back, `${look.id} ${key}=${value} doesn't decode`);
        assert.equal(styleValue(back, key), value, `${look.id} ${key}=${value}`);
      }
    }
  }
});

test("presets pick themselves, and each has colours for its card", () => {
  for (const p of STYLE_PRESETS) {
    assert.ok(presetSelected(p, p.theme()), `${p.label} isn't selected by its own theme`);
    assert.ok(presetColors(p).length > 0, `${p.label} has no colours`);
    assert.ok(decodeStyle(encodeStyle(p.theme())), `${p.label} doesn't survive its code`);
  }
  assert.ok(presetSelected(STYLE_PRESETS[0], undefined), "no style at all is the house look");
  assert.equal(presetSelected(STYLE_PRESETS[1], themeFromLook("candy")), false);
});

test("the accent row fits one row, and an off-row colour shows on the custom swatch", () => {
  for (const look of looks) {
    const row = accentRow(themeFromLook(look.id));
    assert.ok(1 + row.tiles.length + row.spread.length <= ACCENT_SLOTS - 1, `${look.id}: too many swatches`);
    assert.equal(row.custom, null);
  }
  assert.equal(accentRow({ ...themeFromLook("pieces"), accentHex: "#123456" }).custom, "#123456");
});

test("a shuffle asked for a mood stays in that mood, and is reproducible", () => {
  for (const mood of moods) {
    for (let seed = 1; seed <= 6; seed++) {
      const a = shuffleTheme(seed, themeFromLook("pieces"), new Set(), [], mood.id);
      assert.equal(a.mood.id, mood.id, `${mood.id} seed ${seed}`);
      assert.ok(mood.looks.includes(a.theme.look), `${mood.id} seed ${seed}: look ${a.theme.look}`);
      assert.deepEqual(shuffleTheme(seed, themeFromLook("pieces"), new Set(), [], mood.id).theme, a.theme);
    }
  }
  // Without a mood, the same seed still makes the same style as before.
  assert.deepEqual(shuffleTheme(7, undefined).theme, shuffleTheme(7, undefined).theme);
});

test("a style on its own becomes Theme.swift and an App that wears it", () => {
  for (const p of STYLE_PRESETS) {
    const { theme, app } = styleSwift(p.theme());
    assertWellFormedSwift(theme, `${p.label} Theme.swift`);
    assertWellFormedSwift(app, `${p.label} App`);
    assert.match(theme, /enum Theme \{/);
    assert.match(theme, /static let accent = Color\(light: 0x[0-9A-F]{6}, dark: 0x[0-9A-F]{6}\)/);
    assert.match(app, /struct MyApp: App/);
    assert.match(app, /\.tint\(Theme\.accent\)/);
    assert.match(app, /ContentView\(\)/);
  }
  const { app } = styleSwift({ ...themeFromLook("pieces"), appearance: "dark" }, "Studio");
  assert.match(app, /struct StudioApp: App/);
  assert.match(app, /\.preferredColorScheme\(\.dark\)/);
});
