import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyFonts, decodeStyle, encodeStyle, fontById, fonts, moods, oklchHex, resolveTheme, sanitizeTheme, shuffleTheme, type StyleSection } from "../src/index.js";

// Style variety: Shuffle's moods, the font catalog and style codes.

test("every mood only names presets and fonts that exist, with body fonts that read at body size", () => {
  for (const m of moods) {
    for (const id of [...m.heading, ...m.body]) assert.equal(fontById(id).id, id, `${m.id}: ${id}`);
    for (const id of m.body) assert.ok(bodyFonts.some((f) => f.id === id), `${m.id}: ${id} is display-only`);
    assert.ok(m.looks.length && m.nouns.length);
  }
});

test("shuffle makes valid, varied, reproducible styles", () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) {
    const { theme } = shuffleTheme(seed, undefined);
    // Sanitizing keeps it as is: nothing Shuffle makes is thrown away when saved or shared.
    const clean = sanitizeTheme(theme)!;
    for (const k of Object.keys(theme) as Array<keyof typeof theme>) assert.deepEqual(clean[k], theme[k], `seed ${seed}: ${String(k)}`);
    assert.ok(theme.name && theme.name.length > 3);
    resolveTheme(theme);
    seen.add(encodeStyle(theme));
  }
  assert.ok(seen.size > 390, `only ${seen.size} distinct styles in 400 shuffles`);
  assert.deepEqual(shuffleTheme(42, undefined).theme, shuffleTheme(42, undefined).theme);
});

test("locked sections keep their values", () => {
  const base = shuffleTheme(7, undefined).theme;
  const locks = new Set<StyleSection>(["type", "colour"]);
  for (let seed = 100; seed < 160; seed++) {
    const t = shuffleTheme(seed, base, locks).theme;
    for (const k of ["font", "headingFont", "textSize", "weight", "look", "accent", "accentHex", "appearance", "backdrop"] as const) assert.deepEqual(t[k], base[k], `${k} at ${seed}`);
  }
});

test("style codes round-trip", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { theme } = shuffleTheme(seed, undefined);
    const back = decodeStyle(encodeStyle(theme));
    assert.ok(back, encodeStyle(theme));
    const { name: _n, ...rest } = theme;
    for (const [k, v] of Object.entries(rest)) assert.deepEqual((back as Record<string, unknown>)[k], v, `${encodeStyle(theme)}: ${k}`);
  }
  assert.equal(decodeStyle("nonsense"), null);
});

test("OKLCH accents are valid hex in and out of gamut", () => {
  for (let h = 0; h < 360; h += 7) for (const c of [0.05, 0.2, 0.37]) assert.match(oklchHex(0.7, c, h), /^#[0-9A-F]{6}$/);
  assert.ok(fonts.length >= 30);
});
