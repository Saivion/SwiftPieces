import type { Metadata } from "next";
import { site } from "@/lib/site";

/**
 * Page metadata in one place, so every indexable page says the same things the same way:
 *
 * - a self-referencing canonical with the absolute URL, so search engines never guess;
 * - Open Graph and Twitter tags with a title, a description and an image, so shared links render
 *   with context (a child segment's `openGraph` replaces the parent's whole object in Next, so it is
 *   rebuilt here in full rather than inherited);
 * - a description short enough not to be cut off in results (see `snippet`).
 *
 * `title` is the page's own title; the root layout's template adds " — Swift Pieces" to the tab
 * title, and the social title is composed the same way here.
 */

/** The site-wide share card: app/opengraph-image.png, served from the root. */
export const DEFAULT_OG_IMAGE = { url: `${site.url}/opengraph-image.png`, width: 1200, height: 630, alt: `${site.name}` };

/** Longest meta description before search results start cutting it off. */
const DESCRIPTION_MAX = 155;

/**
 * A description that fits in a search snippet, built only from the page's own words: whole sentences
 * while they fit, otherwise the first sentence cut at a word boundary. Never adds claims.
 */
export function snippet(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim()) return out.trim();
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  absoluteTitle = false,
}: {
  /** The page's own title. The layout template appends the site name unless `absoluteTitle`. */
  title: string;
  description: string;
  /** The page's path, "/" for the home page. Becomes the canonical URL. */
  path: string;
  /** An absolute image URL for the share card. Defaults to the site card. */
  image?: string;
  /** Use `title` as the whole title (the home page), without the " — Swift Pieces" suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const url = new URL(path, site.url).href;
  const full = absoluteTitle ? title : `${title} — ${site.name}`;
  const desc = snippet(description);
  const images = image ? [{ url: image, alt: full }] : [DEFAULT_OG_IMAGE];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: desc,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: site.name, url, title: full, description: desc, images },
    twitter: { card: "summary_large_image", title: full, description: desc, images: images.map((i) => i.url) },
  };
}
