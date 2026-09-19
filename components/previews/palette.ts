// The Free house palette for web previews (FREE-V2.md §3). Swift mirrors these values in each
// component's `Style` defaults, so a preview and the installed piece match.
//
// Free ships one confident palette. Whole color schemes, brand presets and theming are Pro.

/** Grounds and ink for the dark stage every preview stands on. */
export const ground = {
  bg: "#121212",
  surface: "#1c1c1c",
  raised: "#262626",
  line: "rgba(255,255,255,0.08)",
  text: "#f4f3ef",
  muted: "#a6a49f",
  subtle: "#6f6d69",
} as const;

/** The light appearance, for pieces shown on paper. */
export const paper = {
  bg: "#f3f2ee",
  surface: "#ffffff",
  raised: "#ffffff",
  line: "rgba(0,0,0,0.08)",
  text: "#141414",
  muted: "#5c5a56",
  subtle: "#8b8984",
} as const;

/** Ink that sits on every block. Blocks are chosen so this always reads (4.5:1 or better). */
export const ink = "#141414";

/** Signal: the one action color. Used for the primary action, never for decoration. */
export const signal = { fill: "#ff0000", on: "#141414" } as const;

/** Solid blocks for categories, data and highlights. Always with `ink` on top.
 *  `tangerine` is the site accent, the same value as `signal` and the Get Pro button
 *  (owner, 2026-09-17): no second, dimmer orange anywhere. */
export const blocks = {
  tangerine: "#ff0000",
  sky: "#9cc2ff",
  butter: "#ffd976",
  sage: "#a9dcb7",
  lilac: "#cdb8ff",
  sand: "#e9d5b3",
} as const;
export type BlockName = keyof typeof blocks;
export const blockList: string[] = Object.values(blocks);

/** Corner radii (px at the 560 px docs stage; scale with cqw in previews). */
export const radius = { sm: 12, md: 18, lg: 26, xl: 34 } as const;

/** Type: SF Pro stack. Display runs heavy and tight; big figures run light. */
export const font = {
  stack: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
  displayWeight: 700,
  displayTracking: "-0.04em",
  numeralWeight: 300,
} as const;
