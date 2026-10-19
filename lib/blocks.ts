// Blocks: whole sections of an iOS screen, built from SwiftPieces components. A sign-in block is the
// form fields, the password entry and the commit button already laid out, wired and given their
// states; you drop it into a screen and connect it to your app.
//
// Free blocks live in registry/blocks/<category>/<Name>Block.swift and build like pieces
// (scripts/build-registry.ts). Pro blocks live in SwiftPieces Pro; Free never reads the Pro registry
// (Rev 3 §3.2), so `proBlocks` below is the one hand-kept copy of their names and summaries. Refresh it
// from SwiftPiecesPro/registry/index.ts when a Pro block ships or changes.
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
  /** Day it shipped ("YYYY-MM-DD"), for the New badge, the same rule as free blocks. */
  added: string;
};

export const proBlocks: ProBlock[] = [
  {
    id: "plan-usage",
    name: "PlanUsageBlock",
    title: "Plan and Usage",
    category: "settings",
    summary: "The subscription section of Settings: the current plan, what has been used of it, and the way up.",
    description: "Where a subscriber checks their plan. The plan sits on a solid card with its price and renewal date; usage meters below fill to what has been used and warn as one nears its limit; upgrading, managing the subscription in the App Store and restoring a purchase are one tap each.",
    parts: ["Current plan card with its renewal", "Usage meters that warn near a limit", "Upgrade call to action", "Manage subscription and restore"],
    added: "2026-10-19",
  },
  {
    id: "invite-friends",
    name: "InviteFriendsBlock",
    title: "Invite Friends",
    category: "social",
    summary: "A referral section: the reward and how close you are, your invite code to copy or share, and who joined.",
    description: "A referral section that pays for itself. A reward track fills a seat for each friend who joins; the invite code copies with one tap and shares through the system share sheet; invited friends list below with where each one is, from invited to joined.",
    parts: ["Reward track that fills per friend", "Invite code you copy", "Share button", "Invited friends and their status"],
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
