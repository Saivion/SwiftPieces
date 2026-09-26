import { colors, grounds, icons } from "../core/palette.js";
import type { PropertyDefinition, PropertyOption } from "../core/schema.js";

export const opts = (...pairs: Array<[string, string]>): PropertyOption[] => pairs.map(([value, label]) => ({ value, label }));

export const text = (id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "text", defaultValue, maxLength: 120, ...extra });
export const bool = (id: string, label: string, defaultValue: boolean, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "boolean", defaultValue, ...extra });
export const select = (id: string, label: string, defaultValue: string, options: PropertyOption[], extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "select", defaultValue, options, ...extra });
export const number = (id: string, label: string, defaultValue: number, min: number, max: number, step = 1, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "number", defaultValue, min, max, step, ...extra });
export const spacing = (id: string, label: string, defaultValue: number, max = 48, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "spacing", defaultValue, min: 0, max, step: 1, ...extra });
export const color = (id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "color", defaultValue, options: colors.map((c) => ({ value: c.id, label: c.label })), ...extra });
export const icon = (id: string, label: string, defaultValue: string, extra: Partial<PropertyDefinition> = {}): PropertyDefinition => ({ id, label, type: "icon", defaultValue, options: icons.map((i) => ({ value: i.id, label: i.label })), ...extra });
export const ground = (id: string, label: string, defaultValue: string): PropertyDefinition => select(id, label, defaultValue, grounds.map((g) => ({ value: g.id, label: g.label })));

/** SwiftUI text styles, with the point size each has at the default Dynamic Type size. */
export const textStyles: Record<string, { label: string; size: number; weight: number; leading: number }> = {
  largeTitle: { label: "Large title", size: 34, weight: 400, leading: 41 },
  title: { label: "Title", size: 28, weight: 400, leading: 34 },
  title2: { label: "Title 2", size: 22, weight: 400, leading: 28 },
  title3: { label: "Title 3", size: 20, weight: 400, leading: 25 },
  headline: { label: "Headline", size: 17, weight: 600, leading: 22 },
  body: { label: "Body", size: 17, weight: 400, leading: 22 },
  callout: { label: "Callout", size: 16, weight: 400, leading: 21 },
  subheadline: { label: "Subheadline", size: 15, weight: 400, leading: 20 },
  footnote: { label: "Footnote", size: 13, weight: 400, leading: 18 },
  caption: { label: "Caption", size: 12, weight: 400, leading: 16 },
};
export const textStyleOptions = Object.entries(textStyles).map(([value, s]) => ({ value, label: s.label }));

export const weights: Record<string, { label: string; css: number | null }> = {
  default: { label: "Default", css: null },
  regular: { label: "Regular", css: 400 },
  medium: { label: "Medium", css: 500 },
  semibold: { label: "Semibold", css: 600 },
  bold: { label: "Bold", css: 700 },
  heavy: { label: "Heavy", css: 800 },
  black: { label: "Black", css: 900 },
};
export const weightOptions = Object.entries(weights).map(([value, w]) => ({ value, label: w.label }));

/** Horizontal alignment → SwiftUI `HorizontalAlignment` / `TextAlignment` member. */
export const hAlign = opts(["leading", "Leading"], ["center", "Center"], ["trailing", "Trailing"]);

/** `.frame(maxWidth: .infinity, alignment: …)` alignment name from vertical and horizontal parts. */
export function frameAlignment(vertical: "top" | "center" | "bottom", horizontal: string): string {
  const h = horizontal === "leading" ? "Leading" : horizontal === "trailing" ? "Trailing" : "";
  if (vertical === "center") return h ? h.toLowerCase() : "center";
  return `${vertical}${h}`;
}
