// Shared helpers for the data-driven app pieces (charts, calendars, stat grids): one tint palette
// that both the preview and the exported Swift read, and parsers for the list props those pieces
// take ("12, 18, 9", "Label | value | note; …"), so the preview and the Swift always agree.
import type { PropertyDefinition } from "../../core/schema.js";
import { num } from "../../core/swift.js";
import { swiftSignal } from "../../core/palette.js";
import { own } from "../../core/own.js";

/** Named tints for app pieces, as hex. Swift gets the same values as `Color(red:green:blue:)`. */
export const TINTS: Record<string, string> = {
  // The SwiftPieces sweep (the Pro card halftone): what the app library recreations paint with.
  signal: "#FF0000",
  ember: "#FF7A3C",
  blush: "#FF8FB8",
  azure: "#4D8DFF",
  orange: "#F47A3A",
  amber: "#F5B82E",
  red: "#E9485B",
  pink: "#EE5C8F",
  green: "#2FBF71",
  mint: "#3ED3A3",
  teal: "#1E9A94",
  sky: "#6CC4F5",
  blue: "#4F86E8",
  indigo: "#5B5FD6",
  violet: "#A08BF5",
  lavender: "#C9BEFA",
  brown: "#8A5A3B",
  olive: "#8C9A3E",
  gray: "#A5A7AD",
  ink: "#1C1C1E",
  white: "#FFFFFF",
};
export const tintIds = Object.keys(TINTS);
export const tintHex = (id: string, fallback = "orange") => own(TINTS, id) ?? own(TINTS, fallback) ?? "#888888";

/** A tint `select` property over the shared palette. */
export function tint(id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return { id, label, type: "select", defaultValue, options: tintIds.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })), group: "color", ...extra };
}

/** A long data text property (lists of values or items). */
export function data(id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return { id, label, type: "text", defaultValue, maxLength: 900, group: "content", ...extra };
}

/** `Color(red:green:blue:)` for a hex value. */
export function swiftHex(hex: string, opacity = 1): string {
  const v = hex.replace("#", "");
  const sig = swiftSignal(v, opacity);
  if (sig) return sig;
  const c = [0, 2, 4].map((i) => num(parseInt(v.slice(i, i + 2), 16) / 255));
  return `Color(red: ${c[0]}, green: ${c[1]}, blue: ${c[2]}${opacity !== 1 ? `, opacity: ${num(opacity)}` : ""})`;
}
export const swiftTint = (id: string, fallback = "orange") => swiftHex(tintHex(id, fallback));

/** Comma-separated numbers; anything unparsable is dropped. */
export function numbers(value: unknown, max = 60): number[] {
  return String(value ?? "")
    .split(",")
    .filter((s) => s.trim() !== "")
    .map((s) => Number(s.trim()))
    .filter((v) => Number.isFinite(v))
    .slice(0, max);
}

/** Comma-separated words. */
export function items(value: unknown, max = 40): string[] {
  return String(value ?? "").split(",").map((w) => w.trim()).filter(Boolean).slice(0, max);
}

/** Semicolon-separated records, each split into trimmed fields on `|`. */
export function records(value: unknown, max = 24): string[][] {
  return String(value ?? "")
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((r) => r.split("|").map((f) => f.trim()));
}

/** Swift literals. */
export const swiftNums = (v: number[]) => `[${v.map((x) => (Number.isInteger(x) ? `${x}.0` : num(x))).join(", ")}]`;
export const swiftStrs = (v: string[], str: (s: string) => string) => `[${v.map(str).join(", ")}]`;

/** A value split into number runs (drawn large) and unit runs (drawn small): "8h 19m" → 8,h,19,m. */
export function valueRuns(value: string): Array<{ text: string; unit: boolean }> {
  if (!/[0-9]/.test(value)) return [{ text: value, unit: false }];
  const out: Array<{ text: string; unit: boolean }> = [];
  for (const m of value.matchAll(/([0-9][0-9.,:]*)|([^0-9]+)/g)) {
    const t = m[0];
    const unit = !m[1];
    if (unit && !t.trim()) continue;
    out.push({ text: unit ? t.trim() : t, unit });
  }
  return out;
}

/** A smooth path through points (Catmull-Rom as cubic Béziers), for the SVG previews. */
export function smoothPath(pts: Array<[number, number]>, tension = 0.5): string {
  if (!pts.length) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const k = tension / 3;
    d += ` C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
  }
  return d;
}
