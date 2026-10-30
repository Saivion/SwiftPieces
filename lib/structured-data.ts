import { categories, type Category } from "@/lib/categories";
import { categoryHubPath, getHub } from "@/lib/hubs";
import { faqJsonLd, ORG_ID, WEBSITE_ID } from "@/lib/seo";
import { site } from "@/lib/site";

/** The free library as one product. Piece pages point at this id. */
export const SOFTWARE_ID = `${site.url}/#software`;

type Faq = { q: string; a: string };

/**
 * The free library as a product: price 0, no rating. Only facts the home page also shows.
 * Ratings are omitted because the site has none to report.
 */
export function softwareApplicationJsonLd(description: string) {
  return {
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID,
    name: site.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "iOS 17 or later",
    description,
    url: site.url,
    installUrl: `${site.url}/docs/installation`,
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      url: site.url,
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    license: `${site.url}/license`,
    publisher: { "@id": ORG_ID },
  };
}

export function librarySourceJsonLd(count: number) {
  return {
    "@type": "SoftwareSourceCode",
    "@id": `${site.url}/#library`,
    name: `${site.name} free SwiftUI component library`,
    description: `${count} free SwiftUI components for iOS: one self-contained Swift file each, Apple frameworks only, installed by copy-paste, the swiftpieces CLI or an MCP server.`,
    url: `${site.url}/components`,
    codeRepository: site.github,
    programmingLanguage: { "@type": "ComputerLanguage", name: "Swift" },
    runtimePlatform: "iOS 17+",
    license: `${site.url}/license`,
    isAccessibleForFree: true,
    targetProduct: { "@id": SOFTWARE_ID },
    publisher: { "@id": ORG_ID },
  };
}

/** Home page graph: site, publisher, the free app, the source, and the questions on the page. */
export function homeStructuredData(count: number, questions: readonly Faq[], description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": WEBSITE_ID, name: site.name, alternateName: "SwiftPieces", url: site.url, description, publisher: { "@id": ORG_ID } },
      { "@type": "Organization", "@id": ORG_ID, name: site.name, alternateName: "SwiftPieces", url: site.url, logo: `${site.url}/logo.png`, sameAs: [site.github, site.twitter] },
      softwareApplicationJsonLd(description),
      librarySourceJsonLd(count),
      faqJsonLd(questions),
    ],
  };
}

/** Breadcrumb trail for one component's docs page: home, the library, its category, the piece. */
export function pieceBreadcrumbTrail(item: { title: string; category: Category }, path: string): [string, string][] {
  const hub = getHub(categories[item.category].slug);
  return [
    ["SwiftPieces", "/"],
    ["Components", "/components"],
    [hub?.name ?? categories[item.category].title, categoryHubPath(item.category)],
    [item.title, path],
  ];
}

const RATING_KEYS = new Set(["aggregateRating", "ratingValue", "ratingCount", "reviewCount"]);

/** Keys that would assert a rating or a review count. The site has neither. */
export function ratingKeys(data: unknown, path = "$"): string[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return data.flatMap((item, i) => ratingKeys(item, `${path}[${i}]`));
  return Object.entries(data).flatMap(([key, value]) => {
    const here = `${path}.${key}`;
    return [...(RATING_KEYS.has(key) ? [here] : []), ...ratingKeys(value, here)];
  });
}

export function nodesOf(data: unknown, type: string): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return data.flatMap((item) => nodesOf(item, type));
  const record = data as Record<string, unknown>;
  const own = record["@type"] === type ? [record] : [];
  return [...own, ...Object.values(record).flatMap((value) => nodesOf(value, type))];
}
