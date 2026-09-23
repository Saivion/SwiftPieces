import "server-only";
import { site } from "@/lib/site";

/**
 * Sponsorship for the open-source library. Pro is a product and is never sponsored; this is what
 * funds the free pieces.
 *
 * Model (researched 2026-09-23 against Vue, Tailwind, Motion, MUI, Chakra, Mantine, Astro and
 * the solo Swift maintainers): the money is in a few company tiers whose logos sit where
 * developers look, not in individual tips. Motion's individual tiers drew about €100/mo; Astro's
 * single largest sponsor gave $337k. So there is one tip tier for people who want to give, and
 * three company tiers priced for a young library, with the top tier capped so its placement
 * stays worth buying.
 *
 * Payments run through GitHub Sponsors (no fee from personal accounts, and an API that lists who
 * sponsors). Companies that need an invoice or cannot pay through GitHub email instead and are
 * added to `invoiced` below.
 */

export type TierId = "supporter" | "bronze" | "silver" | "gold";

export type Tier = {
  id: TierId;
  name: string;
  /** Monthly, in US dollars. Must match the tier created on github.com/sponsors. */
  price: number;
  audience: "individual" | "company";
  pitch: string;
  perks: string[];
  /** Hard cap on how many sponsors this tier takes, so the placement keeps its value. */
  slots?: number;
};

export const tiers: Tier[] = [
  {
    id: "supporter",
    name: "Supporter",
    price: 5,
    audience: "individual",
    pitch: "For developers who ship with the free pieces and want to keep them coming.",
    perks: ["Your name on this page", "Listed as a sponsor on GitHub", "Cancel any time"],
  },
  {
    id: "bronze",
    name: "Bronze",
    price: 100,
    audience: "company",
    pitch: "For studios and indie teams who build on Swift Pieces.",
    perks: ["Small logo on this page", "Logo in the GitHub README", "Everything in Supporter"],
  },
  {
    id: "silver",
    name: "Silver",
    price: 300,
    audience: "company",
    pitch: "For tools and companies that want to reach iOS developers where they read.",
    perks: ["Medium logo on this page", "Logo in the docs sidebar, on every docs page", "A thank-you post from @saivion on X", "Everything in Bronze"],
  },
  {
    id: "gold",
    name: "Gold",
    price: 750,
    audience: "company",
    pitch: "The headline placement, limited to three sponsors at a time.",
    perks: ["Large logo on the swiftpieces.com homepage", "Top of this page and the README", "One Swift Pieces Pro license for your team", "Everything in Silver"],
    slots: 3,
  },
];

export const tierById = (id: TierId) => tiers.find((t) => t.id === id)!;

/** Where the money goes, stated plainly on the page. */
export const sponsorLinks = {
  github: `https://github.com/sponsors/${site.github.split("/")[3]}`,
  email: "mailto:saivion@swiftpieces.com?subject=Swift%20Pieces%20sponsorship",
} as const;

export type Sponsor = {
  name: string;
  url: string;
  /** Square logo or avatar. GitHub avatars are used for GitHub sponsors. */
  logo: string;
  tier: TierId;
};

/**
 * Sponsors who pay by invoice rather than through GitHub. Add them here by hand; they merge with
 * the live GitHub list. Logos go in /public/sponsors.
 */
const invoiced: Sponsor[] = [];

/** Highest tier whose price the monthly amount covers. Custom amounts fall into the tier below. */
function tierFor(monthly: number): TierId {
  const hit = [...tiers].reverse().find((t) => monthly >= t.price);
  return hit?.id ?? "supporter";
}

type SponsorEntity = { login: string; name: string | null; url: string; avatarUrl: string; websiteUrl: string | null };
type SponsorshipsResponse = {
  data?: {
    viewer?: {
      sponsorshipsAsMaintainer?: {
        nodes: { privacyLevel: "PUBLIC" | "PRIVATE"; tier: { monthlyPriceInDollars: number; isOneTime: boolean } | null; sponsorEntity: SponsorEntity | null }[];
      };
    };
  };
};

/**
 * Active public GitHub sponsors, read with the maintainer's token (GITHUB_SPONSORS_TOKEN: a
 * classic token with `read:user` and `read:org`). Cached for an hour. Without a token, or if
 * GitHub fails, only the invoiced list is shown: the page never breaks over it.
 */
async function githubSponsors(): Promise<Sponsor[]> {
  const token = process.env.GITHUB_SPONSORS_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "swiftpieces.com" },
      body: JSON.stringify({
        query: `{ viewer { sponsorshipsAsMaintainer(first: 100, activeOnly: true) { nodes {
          privacyLevel
          tier { monthlyPriceInDollars isOneTime }
          sponsorEntity { ... on User { login name url avatarUrl websiteUrl } ... on Organization { login name url avatarUrl websiteUrl } }
        } } } }`,
      }),
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as SponsorshipsResponse;
    const nodes = json.data?.viewer?.sponsorshipsAsMaintainer?.nodes ?? [];
    return nodes
      .filter((n) => n.privacyLevel === "PUBLIC" && n.sponsorEntity && n.tier && !n.tier.isOneTime)
      .map((n) => {
        const e = n.sponsorEntity!;
        return { name: e.name || e.login, url: e.websiteUrl || e.url, logo: e.avatarUrl, tier: tierFor(n.tier!.monthlyPriceInDollars) };
      });
  } catch {
    return [];
  }
}

/** Every current sponsor, highest tier first. */
export async function getSponsors(): Promise<Sponsor[]> {
  const rank: Record<TierId, number> = { gold: 0, silver: 1, bronze: 2, supporter: 3 };
  const all = [...invoiced, ...(await githubSponsors())];
  return all.sort((a, b) => rank[a.tier] - rank[b.tier] || a.name.localeCompare(b.name));
}

/** Sponsors at or above a tier, for placements that only some tiers get. */
export async function getSponsorsFrom(min: TierId): Promise<Sponsor[]> {
  const order: TierId[] = ["supporter", "bronze", "silver", "gold"];
  const floor = order.indexOf(min);
  return (await getSponsors()).filter((s) => order.indexOf(s.tier) >= floor);
}
