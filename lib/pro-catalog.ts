// What Swift Pieces Pro contains, for marketing copy on the free site. Free never reads the Pro
// registry (Rev 3 §3.2), so this is the one hand-maintained copy: when Pro's library changes,
// update these numbers and names here and every page follows.
// Source of truth: SwiftPiecesPro `typeCounts()` (registry/__registry__/public.json) and `kitCounts()` (lib/kit.ts).
// No price lives here on purpose: pricing is shown only on pro.swiftpieces.com, so every Free CTA sends people there.

export const proCatalog = {
  screens: 48,
  templates: 10,
  /** The Build Kit: skills a buyer's coding agent follows (Pro lib/kit.ts kitCounts()). */
  buildKit: { total: 24, setup: 1, styles: 8, briefs: 8, recipes: 5, tools: 2 },
  /** A few screen names, in the order Pro features them. */
  screenExamples: ["Wallet", "Budget", "Dashboard", "Chat", "Voice Mode", "Paywall", "Now Playing"],
  /** Every template, short form. */
  templateNames: ["subscription", "finance", "AI assistant", "productivity", "meditation", "travel", "sleep", "smart home", "weather", "meal planner"],
  /** Each template's fictional app and what it is, as Pro's template pages name them. */
  templateApps: [
    { app: "Cadence", kind: "Subscription" },
    { app: "Ledgerly", kind: "Finance" },
    { app: "Nimbus", kind: "AI assistant" },
    { app: "Margin", kind: "Productivity" },
    { app: "Stillwater", kind: "Meditation" },
    { app: "Wayfare", kind: "Travel" },
    { app: "Drift", kind: "Sleep" },
    { app: "Maison", kind: "Smart home" },
    { app: "Almanac", kind: "Weather" },
    { app: "Sprig", kind: "Meal planner" },
  ],
} as const;

/** "Wallet, Budget, Dashboard and more" style lists. */
export function namesWithMore(names: readonly string[], take = names.length): string {
  const picked = names.slice(0, take);
  return names.length > take ? `${picked.join(", ")} and more` : `${picked.slice(0, -1).join(", ")} and ${picked.at(-1)}`;
}

/** "48 screens, 10 app templates and a 24-item Build Kit". */
export const proCountsLabel = `${proCatalog.screens} screens, ${proCatalog.templates} app templates and a ${proCatalog.buildKit.total}-item Build Kit`;

/** One line on the Build Kit for Free's Pro teasers. */
export const buildKitLine = `${proCatalog.buildKit.styles} styles, ${proCatalog.buildKit.briefs} briefs and ${proCatalog.buildKit.recipes} recipes and ${proCatalog.buildKit.tools} tools your coding agent follows, written against the same design system, so everything it builds next matches`;
