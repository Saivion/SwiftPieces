// The fonts Style offers. Every one is free to use in an iOS app with nothing to bundle: the four
// system designs (SF Pro, SF Pro Rounded, New York, SF Mono) and families that ship inside iOS,
// which `Font.custom(_:size:relativeTo:)` reaches by name (and which still scale with Dynamic Type).
//
// The web preview draws each with the same font where the viewer has it (every Mac ships these
// families) and otherwise with a close free web font, loaded only when it is used.

export type FontCategory = "system" | "sans" | "serif" | "display" | "slab" | "mono" | "hand";
/** SwiftUI `Font.Design` a family is closest to, so components drawing with the system font follow it. */
export type FontDesign = "default" | "rounded" | "serif" | "monospaced";

export type FontDef = {
  id: string;
  name: string;
  category: FontCategory;
  /** The iOS family `Font.custom` takes; absent for the system designs. */
  family?: string;
  /** The system design: the font itself for system fonts, the nearest one for a family. */
  design: FontDesign;
  /** The CSS stack: the real family first, then the web stand-in, then a generic. */
  css: string;
  /** The Google Fonts family (with weights) the preview loads as the stand-in, if any. */
  web?: string;
  /** Headings only: a display face that reads poorly at body sizes. */
  headingOnly?: boolean;
};

const SYSTEM_SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif';

export const fonts: FontDef[] = [
  // System designs: SwiftUI's own, every width and weight.
  { id: "default", name: "SF Pro", category: "system", design: "default", css: SYSTEM_SANS, web: "Inter:wght@300;400;500;600;700;800" },
  { id: "rounded", name: "SF Rounded", category: "system", design: "rounded", css: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif', web: "Nunito:wght@300;400;500;600;700;800" },
  { id: "serif", name: "New York", category: "system", design: "serif", css: 'ui-serif, "New York", "Source Serif 4", Georgia, serif', web: "Source+Serif+4:wght@300;400;500;600;700" },
  { id: "mono", name: "SF Mono", category: "system", design: "monospaced", css: 'ui-monospace, "SF Mono", Menlo, "JetBrains Mono", monospace', web: "JetBrains+Mono:wght@300;400;500;600;700" },
  // Sans families in iOS.
  { id: "avenir-next", name: "Avenir Next", category: "sans", family: "Avenir Next", design: "default", css: '"Avenir Next", "Nunito Sans", sans-serif', web: "Nunito+Sans:wght@300;400;500;600;700;800" },
  { id: "futura", name: "Futura", category: "sans", family: "Futura", design: "default", css: 'Futura, "Futura PT", "Jost", sans-serif', web: "Jost:wght@300;400;500;600;700" },
  { id: "gill-sans", name: "Gill Sans", category: "sans", family: "Gill Sans", design: "default", css: '"Gill Sans", "Gill Sans MT", "Lato", sans-serif', web: "Lato:wght@300;400;700;900" },
  { id: "helvetica", name: "Helvetica Neue", category: "sans", family: "Helvetica Neue", design: "default", css: '"Helvetica Neue", Helvetica, "Arimo", Arial, sans-serif', web: "Arimo:wght@400;500;600;700" },
  { id: "optima", name: "Optima", category: "sans", family: "Optima", design: "default", css: 'Optima, "Tenor Sans", sans-serif', web: "Tenor+Sans" },
  { id: "trebuchet", name: "Trebuchet", category: "sans", family: "Trebuchet MS", design: "default", css: '"Trebuchet MS", "Fira Sans", sans-serif', web: "Fira+Sans:wght@300;400;500;600;700" },
  { id: "verdana", name: "Verdana", category: "sans", family: "Verdana", design: "default", css: 'Verdana, "PT Sans", sans-serif', web: "PT+Sans:wght@400;700" },
  { id: "arial-rounded", name: "Arial Rounded", category: "sans", family: "Arial Rounded MT Bold", design: "rounded", css: '"Arial Rounded MT Bold", "Varela Round", sans-serif', web: "Varela+Round" },
  { id: "din", name: "DIN Alternate", category: "sans", family: "DIN Alternate", design: "default", css: '"DIN Alternate", "Barlow", sans-serif', web: "Barlow:wght@400;500;600;700" },
  { id: "din-condensed", name: "DIN Condensed", category: "display", family: "DIN Condensed", design: "default", css: '"DIN Condensed", "Barlow Condensed", sans-serif', web: "Barlow+Condensed:wght@500;600;700", headingOnly: true },
  // Serif families in iOS.
  { id: "charter", name: "Charter", category: "serif", family: "Charter", design: "serif", css: 'Charter, "Charis SIL", Georgia, serif', web: "Charis+SIL:wght@400;700" },
  { id: "georgia", name: "Georgia", category: "serif", family: "Georgia", design: "serif", css: 'Georgia, "Gelasio", serif', web: "Gelasio:wght@400;500;600;700" },
  { id: "iowan", name: "Iowan Old Style", category: "serif", family: "Iowan Old Style", design: "serif", css: '"Iowan Old Style", "Crimson Pro", Georgia, serif', web: "Crimson+Pro:wght@400;500;600;700" },
  { id: "baskerville", name: "Baskerville", category: "serif", family: "Baskerville", design: "serif", css: 'Baskerville, "Libre Baskerville", Georgia, serif', web: "Libre+Baskerville:wght@400;700" },
  { id: "palatino", name: "Palatino", category: "serif", family: "Palatino", design: "serif", css: 'Palatino, "Palatino Linotype", "Domine", serif', web: "Domine:wght@400;500;600;700" },
  { id: "cochin", name: "Cochin", category: "serif", family: "Cochin", design: "serif", css: 'Cochin, "Cormorant Garamond", serif', web: "Cormorant+Garamond:wght@400;500;600;700" },
  // Display serifs: headlines.
  { id: "didot", name: "Didot", category: "display", family: "Didot", design: "serif", css: 'Didot, "Playfair Display", serif', web: "Playfair+Display:wght@400;500;600;700;800", headingOnly: true },
  { id: "bodoni", name: "Bodoni 72", category: "display", family: "Bodoni 72", design: "serif", css: '"Bodoni 72", "Bodoni Moda", serif', web: "Bodoni+Moda:wght@400;500;600;700", headingOnly: true },
  { id: "copperplate", name: "Copperplate", category: "display", family: "Copperplate", design: "serif", css: 'Copperplate, "Cinzel", serif', web: "Cinzel:wght@400;500;600;700", headingOnly: true },
  // Slabs.
  { id: "rockwell", name: "Rockwell", category: "slab", family: "Rockwell", design: "serif", css: 'Rockwell, "Roboto Slab", serif', web: "Roboto+Slab:wght@300;400;500;600;700" },
  { id: "superclarendon", name: "Superclarendon", category: "slab", family: "Superclarendon", design: "serif", css: 'Superclarendon, "Sanchez", serif', web: "Sanchez", headingOnly: true },
  { id: "american-typewriter", name: "American Typewriter", category: "slab", family: "American Typewriter", design: "serif", css: '"American Typewriter", "Courier Prime", serif', web: "Courier+Prime:wght@400;700" },
  // Monospaced.
  { id: "menlo", name: "Menlo", category: "mono", family: "Menlo", design: "monospaced", css: 'Menlo, "JetBrains Mono", monospace', web: "JetBrains+Mono:wght@300;400;500;600;700" },
  { id: "courier", name: "Courier New", category: "mono", family: "Courier New", design: "monospaced", css: '"Courier New", "Courier Prime", monospace', web: "Courier+Prime:wght@400;700" },
  // Hand and friendly.
  { id: "chalkboard", name: "Chalkboard", category: "hand", family: "Chalkboard SE", design: "rounded", css: '"Chalkboard SE", "Short Stack", sans-serif', web: "Short+Stack" },
  { id: "noteworthy", name: "Noteworthy", category: "hand", family: "Noteworthy", design: "rounded", css: 'Noteworthy, "Kalam", sans-serif', web: "Kalam:wght@300;400;700", headingOnly: true },
  { id: "marker-felt", name: "Marker Felt", category: "hand", family: "Marker Felt", design: "rounded", css: '"Marker Felt", "Permanent Marker", sans-serif', web: "Permanent+Marker", headingOnly: true },
];

const byId = new Map(fonts.map((f) => [f.id, f]));
export const fontIds = fonts.map((f) => f.id);
export const isFontId = (v: unknown): v is string => typeof v === "string" && byId.has(v);
/** A font by id, the system default when unknown. */
export const fontById = (id: string | undefined): FontDef => byId.get(id ?? "") ?? fonts[0];
/** Fonts that work for body text (every one but the display faces). */
export const bodyFonts = fonts.filter((f) => !f.headingOnly);

export const FONT_CATEGORIES: Array<{ id: FontCategory; label: string }> = [
  { id: "system", label: "System" },
  { id: "sans", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "slab", label: "Slab" },
  { id: "mono", label: "Mono" },
  { id: "hand", label: "Hand" },
];

/**
 * The Google Fonts stylesheet for the stand-ins of these fonts (null when none needs one). `text`
 * limits it to a few glyphs (the "Aa" of a font tile), which keeps a whole catalog preview tiny.
 */
export function webFontsHref(ids: string[], text?: string): string | null {
  const families = [...new Set(ids.map((id) => byId.get(id)?.web).filter((w): w is string => Boolean(w)))];
  if (!families.length) return null;
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;
}
