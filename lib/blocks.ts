// Blocks: whole sections of an iOS screen, laid out, wired and given their states. A sign-in block is the
// fields, the button and Sign in with Apple already working; you drop it into a screen and connect it to your app.
//
// Every block is a SwiftPieces Pro block since 2026-10-19: its source lives in SwiftPieces Pro, themed by Pro's
// design system, and installs only with a Pro license, like Pro's screens and templates. Free lists them with a
// still and their facts. Free never reads the Pro registry (Rev 3 §3.2), so `proBlocks` below is the one hand-kept
// copy of their names and summaries. Refresh it from SwiftPiecesPro/registry/index.ts when a Pro block ships or
// changes, and recapture its still (public/pro-blocks/<id>.webp) from its Pro page. The build still supports free
// blocks in registry/blocks/<category>/<Name>Block.swift, should one ever ship.
// Pure data: safe to import from client components.
import { site } from "./site";

/** Block categories, in sidebar order. One place for the id, docs slug, title, Xcode folder and one line. */
export const blockCategories = {
  auth: { slug: "auth", title: "Auth", folder: "Auth", description: "Sign in, sign up and verification, laid out and wired to your backend in one closure." },
  settings: { slug: "settings", title: "Settings", folder: "Settings", description: "Account and preference sections with the controls already chosen." },
  analytics: { slug: "analytics", title: "Analytics", folder: "Analytics", description: "Dashboard sections: a headline chart you scrub, live tiles and breakdowns." },
  commerce: { slug: "commerce", title: "Commerce", folder: "Commerce", description: "Bag, delivery and payment as one checkout you can step back through." },
  social: { slug: "social", title: "Social", folder: "Social", description: "Invites, profiles and the people around the person using your app." },
} as const;

export type BlockCategory = keyof typeof blockCategories;
export const blockCategoryIds = Object.keys(blockCategories) as [BlockCategory, ...BlockCategory[]];
export const blockCategoryTitle = (id: string): string => (blockCategories as Record<string, { title: string }>)[id]?.title ?? id;

/** A Pro block as Free lists it. Its Swift source is never in this repo. */
export type ProBlock = {
  /** Pro registry id: its page is pro.swiftpieces.com/library/blocks/<id>. */
  id: string;
  /** The Swift type, which is also the name the CLI installs. */
  name: string;
  title: string;
  category: BlockCategory;
  /** One line, as Pro's library card says it. */
  summary: string;
  /** What the block does, for its page on Free: two or three sentences. */
  description: string;
  /**
   * What is inside it, in reading order, as Pro's library lists it. Pro blocks are self-contained and themed by
   * Pro's design system, like Pro's screens, so these are the block's own parts, not free pieces.
   */
  parts: string[];
  /** Day it shipped ("YYYY-MM-DD"), for the New badge, the same rule as pieces. */
  added: string;
};

export const proBlocks: ProBlock[] = [
  {
    id: "sign-in",
    name: "SignInBlock",
    title: "Sign In",
    category: "auth",
    summary: "The sign-in section of a welcome screen: email and password, Sign in with Apple, a passkey and Create account in one block.",
    description: "Email and password on one card, checked on submit and then live, with Sign in running your closure through working, done and failed. Forgot password confirms inline, Sign in with Apple is the system button in the colour of the appearance, and a link at the foot switches to Create account with password rules that tick off.",
    parts: ["Email and password with autofill", "Sign in with its working, done and failed states", "Sign in with Apple and a passkey", "Forgot password and create account"],
    added: "2026-10-19",
  },
  {
    id: "account-settings",
    name: "AccountSettingsBlock",
    title: "Account Settings",
    category: "settings",
    summary: "The account section at the top of Settings: profile and photo, appearance, notifications, your data, sign out and deletion.",
    description: "The part of Settings every app with accounts needs. A profile card changes the photo and the name in place, appearance shows System, Light and Dark as small screens in your theme's colours, and notification toggles know when iOS has notifications off. Export my data, Sign out and Delete account each confirm and show their own working, done and failed states.",
    parts: ["Profile with photo and name", "Appearance in your theme's colours", "Notification toggles", "Your data, sign out and delete account"],
    added: "2026-10-19",
  },
  {
    id: "plan-usage",
    name: "PlanUsageBlock",
    title: "Plan and Usage",
    category: "settings",
    summary: "The subscription section of Settings: the plan and its renewal, usage meters that warn near a limit, and the way up.",
    description: "Where a subscriber checks their plan. A summary card names the plan with a tinted status chip, its price and when it renews, ends or leaves its trial; usage meters fill to what has been used and turn to warning and danger near a limit. Upgrade works, confirms and folds away on the top plan, and Manage subscription and Restore purchases use StoreKit by default.",
    parts: ["Plan with its status and renewal", "Usage meters that warn near a limit", "Upgrade with its states", "Manage subscription and restore"],
    added: "2026-10-19",
  },
  {
    id: "invite-friends",
    name: "InviteFriendsBlock",
    title: "Invite Friends",
    category: "social",
    summary: "A referral section: what both people get, a track that fills as friends join, the invite code to copy or share, and who you invited.",
    description: "The referral section of an account or rewards screen. One card states the reward, fills a seat on a quiet track for each friend who joins, copies the invite code with one tap and opens the system share sheet. Invited friends list below with a status chip, and pending invites can be reminded.",
    parts: ["Reward and a track that fills per friend", "Invite code you copy", "Share invite", "Invited friends with their status"],
    added: "2026-10-19",
  },
  {
    id: "stats-overview",
    name: "StatsOverviewBlock",
    title: "Stats Overview",
    category: "analytics",
    summary: "The top of a dashboard: a headline metric and its change, a chart you scrub across 1W to 1Y, and metric tiles.",
    description: "The section at the top of an analytics or dashboard screen. One card holds the headline metric with its change against the previous period and a Swift Charts line you drag across to read any day, with the previous period dashed beneath and a 1W to 1Y control that morphs the line. Metric tiles sit below, and loading, empty and failed states are built in.",
    parts: ["Headline metric and its change", "Chart you scrub", "Range control from 1W to 1Y", "Metric tiles"],
    added: "2026-10-19",
  },
  {
    id: "checkout",
    name: "CheckoutBlock",
    title: "Checkout",
    category: "commerce",
    summary: "A one-column checkout: bag with steppers, address and delivery speed, promo code, summary, then Pay or Apple Pay to the placed order.",
    description: "The checkout section of a cart or checkout screen. Each bag line has a quantity stepper, and the line price, summary and Pay label roll as quantities change; delivery shows the address with Change and each speed with its day and price, and a promo code applies or explains why not. Pay shows its working, done and failed states in place, Apple Pay uses the system button, and the block settles into the placed order with its number and arrival day.",
    parts: ["Bag with quantity steppers", "Address and delivery speed", "Promo code and a total that follows", "Pay and Apple Pay to the placed order"],
    added: "2026-10-19",
  },
];

/** Every block's slug drops the type's "Block" suffix: SignInBlock is /docs/blocks/auth/sign-in. */
export function blockSlug(name: string): string {
  return name
    .replace(/Block$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** Canonical docs path for a block, free or Pro: /docs/blocks/<category>/<slug>. */
export function blockPath(block: { category: string; name: string }): string {
  return `/docs/blocks/${(blockCategories as Record<string, { slug: string }>)[block.category]?.slug ?? block.category}/${blockSlug(block.name)}`;
}

/** Where a Pro block opens in Pro's library. */
export const proBlockUrl = (id: string) => `${site.proUrl}/library/blocks/${id}`;
