// What SwiftPieces Pro contains, for marketing copy on the free site. Free never reads the Pro
// registry (Rev 3 §3.2), so this is the one hand-maintained copy: when Pro's library changes,
// update these numbers and names here and every page follows.
// Source of truth: SwiftPiecesPro `typeCounts()` (registry/__registry__/public.json) and `kitCounts()` (lib/kit.ts).
// Prices here mirror Pro's pricing (proPlans, 2026-11-01: Saivion wants Free to match Pro end to end); checkout itself always happens on pro.swiftpieces.com.

export const proCatalog = {
  screens: 54,
  /** Pro's patterns (Pro typeCounts().block). Their names and summaries live in lib/blocks.ts proBlocks; keep the two in step. */
  blocks: 46,
  templates: 12,
  /** The Build Kit: skills a buyer's coding agent follows (Pro lib/kit.ts kitCounts()). */
  buildKit: { total: 31, setup: 1, styles: 14, briefs: 9, recipes: 5, tools: 2 },
  /**
   * What Pro adds in the Playground (this site's /apps and /playground): every app in the App
   * Library, five free and the rest Pro's (lib/apps, Pro lib/remixing.ts PLAYGROUND_APPS), and
   * saved remixes (Pro SAVE_LIMITS). lib/apps.test.ts checks the app counts against lib/apps.
   */
  remixing: { saves: 100, apps: 34, proApps: 29 },
  /** Flows: every template's journeys (Pro lib/flows.ts flowCount() and flowKindCounts()). */
  flows: { total: 48, onboarding: 12, core: 24, account: 12 },
  /** Brand presets across the templates and the families they come from (Pro lib/brand/presets.ts presetDefs). */
  presets: { total: 36, families: 13 },
  /** A few screen names, in the order Pro features them. */
  screenExamples: ["Wallet", "Budget", "Dashboard", "Chat", "Voice Mode", "Paywall", "Now Playing"],
  /** Every template, short form. */
  templateNames: ["subscription", "finance", "AI assistant", "productivity", "meditation", "travel", "sleep", "smart home", "weather", "meal planner", "fitness", "language learning"],
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
    { app: "Pulse", kind: "Fitness" },
    { app: "Parla", kind: "Language learning" },
  ],
} as const;

/** "Wallet, Budget, Dashboard and more" style lists. */
export function namesWithMore(names: readonly string[], take = names.length): string {
  const picked = names.slice(0, take);
  return names.length > take ? `${picked.join(", ")} and more` : `${picked.slice(0, -1).join(", ")} and ${picked.at(-1)}`;
}

/** The Explore Pro docs pages (/docs/components/<page>), in sidebar order: docs pages, not registry categories. */
export const exploreProPages = ["screens", "flows", "templates"] as const;

/** "54 screens, 48 flows, 12 app templates and a 31-item Build Kit". */
export const proCountsLabel = `${proCatalog.screens} screens, ${proCatalog.flows.total} flows, ${proCatalog.templates} app templates and a ${proCatalog.buildKit.total}-item Build Kit`;

/** One line on the Build Kit for Free's Pro teasers. */
export const buildKitLine = `${proCatalog.buildKit.styles} styles, ${proCatalog.buildKit.briefs} briefs and ${proCatalog.buildKit.recipes} recipes and ${proCatalog.buildKit.tools} tools your coding agent follows, written against the same design system, so everything it builds next matches`;

/**
 * Each Pro template, keyed by app type, for Free's Pro teasers. Hand-kept like everything above (Free never reads the Pro registry): ids and
 * titles come from Pro's registry, `screens` is the number of library items the template is built
 * from, and `embeds` names three of its screens.
 */
export const templateShowcase: Record<string, { id: string; app: string; kind: string; screens: number; embeds: Array<{ id: string; title: string }> }> = {
  subscription: { id: "subscription-app", app: "Cadence", kind: "Subscription", screens: 6, embeds: [{ id: "onboarding-flow", title: "Onboarding" }, { id: "glass-paywall-screen", title: "Purchase" }, { id: "bento-grid", title: "What's New" }] },
  finance: { id: "finance-app", app: "Ledgerly", kind: "Finance", screens: 7, embeds: [{ id: "wallet-stack", title: "Wallet" }, { id: "spending-ring", title: "Budget" }, { id: "swipe-to-confirm", title: "Send Money" }] },
  ai: { id: "ai-app", app: "Nimbus", kind: "AI assistant", screens: 4, embeds: [{ id: "ai-chat-screen", title: "Chat" }, { id: "voice-orb", title: "Voice Mode" }, { id: "settings-screen", title: "Settings" }] },
  productivity: { id: "productivity-app", app: "Margin", kind: "Productivity", screens: 5, embeds: [{ id: "calendar-strip", title: "Agenda" }, { id: "focus-timer", title: "Focus" }, { id: "dashboard-screen", title: "Dashboard" }] },
  meditation: { id: "meditation-app", app: "Stillwater", kind: "Meditation", screens: 9, embeds: [{ id: "noise-orb", title: "Mood" }, { id: "phase-orb", title: "Breathe" }, { id: "glass-paywall-screen", title: "Purchase" }] },
  travel: { id: "travel-app", app: "Wayfare", kind: "Travel", screens: 12, embeds: [{ id: "hero-expand", title: "Discover" }, { id: "detent-sheet", title: "Nearby" }, { id: "code-entry", title: "Verify" }] },
};

/** Pro remixing, the fourth thing Pro includes, in one line. Pro's lib/remixing.ts says the same. */
export const remixingLine = `Remix all ${proCatalog.remixing.apps} apps in the Playground, keep up to ${proCatalog.remixing.saves} remixes and remix any app with AI`;
/** The same, short, for checklists. */
export const remixingPoint = `Pro remixing: all ${proCatalog.remixing.apps} apps, AI and ${proCatalog.remixing.saves} saved remixes`;

/**
 * SwiftPieces Games, Pro's second product: complete iOS games in SwiftUI and Metal, sold on
 * pro.swiftpieces.com. Hand-kept like proCatalog (source: SwiftPiecesPro lib/games, lib/product.ts).
 * Games are sold as finished base templates, so nothing here says "coming" or "in development".
 */
export const proGames = {
  price: 199,
  systems: 10,
  list: [
    { id: "drift", title: "Drift", genre: "Arcade", line: "A top-down snow rally at blue hour." },
    { id: "lumen", title: "Lumen", genre: "Puzzle", line: "A light-routing puzzle in soft matte ceramic." },
    { id: "twine", title: "Twine", genre: "Arcade", line: "One thumb flies two kites through washi paper." },
    { id: "orbit", title: "Orbit", genre: "Idle", line: "A calm idle voyage printed like a travel poster." },
    { id: "wordly", title: "Wordly", genre: "Word", line: "A daily word game set in glazed tiles." },
  ],
} as const;

/** "Drift, Lumen, Twine, Orbit and Wordly". */
export const proGamesList = namesWithMore(proGames.list.map((g) => g.title));

/**
 * The three plans, as Pro's pricing shows them (SwiftPiecesPro lib/product.ts, components/blocks/plans.tsx).
 * Checkout happens on Pro: each plan's button opens Pro's pricing for that plan.
 */
export const proPlans = {
  pro: 199,
  games: 199,
  everything: 329,
  /** An owner of one product adds the other for this. */
  upgrade: 129,
} as const;
