#!/usr/bin/env node
/**
 * SEO check: what search engines get from the site, page by page, with no JavaScript.
 *
 *   npm run seo:check                                  # production
 *   npm run seo:check -- --base http://localhost:3000  # a local `next start`
 *   npm run seo:check -- --limit 40 --no-desktop        # a quick pass
 *
 * It reads robots.txt and every sitemap (following sitemap indexes), fetches each sitemap URL as
 * Googlebot smartphone and as desktop Chrome, and records status, redirects, TTFB, size, title,
 * description, robots, canonical, H1s, og:image, JSON-LD types, images and internal links. Then it
 * crawls from the home page through plain <a href> links (no JS) to find click depth and orphans,
 * and counts "unique words": the text left once nav, header, footer, scripts and any line that
 * appears on half or more of the pages in the same template are removed.
 *
 * Writes docs/seo/report-<date>.json and docs/seo/report-<date>.md. Exits 1 when a blocker exists:
 * a non-200 sitemap URL, a canonical that is not the URL, noindex on a sitemap URL, a sitemap URL
 * the crawl never reaches, or a JSON-LD block that does not parse.
 *
 * No dependencies: fetch plus regular expressions, which is enough for server-rendered HTML.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const BASE = arg("base", "https://swiftpieces.com").replace(/\/$/, "");
/** The host the sitemaps and canonicals name. A local run checks local pages against production URLs. */
const SITE = arg("site", "https://swiftpieces.com").replace(/\/$/, "");
const LIMIT = Number(arg("limit", "0")) || Infinity;
const CONCURRENCY = Number(arg("concurrency", "6"));
const OUT_DIR = arg("out", "docs/seo");
const DESKTOP = !flag("no-desktop");
const DATE = arg("date", new Date().toISOString().slice(0, 10));
/** Pages in the crawl beyond the sitemap, at most. */
const CRAWL_MAX = Number(arg("crawl-max", "1500"));

const GOOGLEBOT =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** Page families that should carry their own share image, not the site card. */
const OWN_IMAGE_TYPES = [/^\/docs\/components\/[^/]+\/[^/]+$/];
/** Unique words below which an item page is thin (section 5 of the brief). */
const THIN_WORDS = 150;
const THIN_WORDS_WITH_IMAGE = 80;
/** Item page families that the thin rule applies to. Hubs and legal pages are not judged by it. */
const ITEM_TYPES = [/^\/docs\/components\/[^/]+\/[^/]+$/, /^\/docs\/patterns\/[^/]+\/[^/]+$/, /^\/apps\/[^/]+$/, /^\/playground\/[^/]+$/, /^\/docs\/guides\/[^/]+$/];

const toLocal = (url) => (url.startsWith(SITE) ? BASE + url.slice(SITE.length) : url);
const toSite = (url) => (url.startsWith(BASE) ? SITE + url.slice(BASE.length) : url);
const pathOf = (url) => {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};

async function timedFetch(url, ua, { follow = true } = {}) {
  const chain = [];
  let current = url;
  const start = performance.now();
  for (let hop = 0; hop < 10; hop++) {
    let res;
    try {
      res = await fetch(current, { redirect: "manual", headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } });
    } catch (error) {
      return { status: 0, error: String(error?.cause?.code ?? error), chain, ttfb: null, body: "", headers: new Headers() };
    }
    const ttfb = performance.now() - start;
    if (follow && res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      chain.push({ status: res.status, url: current });
      current = new URL(res.headers.get("location"), current).href;
      await res.arrayBuffer().catch(() => {});
      continue;
    }
    const body = await res.text();
    return { status: res.status, finalUrl: current, chain, ttfb: Math.round(ttfb), bytes: Buffer.byteLength(body), body, headers: res.headers };
  }
  return { status: 0, error: "too many redirects", chain, ttfb: null, body: "", headers: new Headers() };
}

async function pool(items, fn, n = CONCURRENCY) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[1] ?? m[2] ?? "") : null;
};

function metaContent(html, key, value) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attr(tag, key) ?? "").toLowerCase() === value) return attr(tag, "content");
  }
  return null;
}

function linkHref(html, rel) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if ((attr(tag, "rel") ?? "").toLowerCase() === rel) return attr(tag, "href");
  }
  return null;
}

function jsonLd(html) {
  const types = [];
  const errors = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === "object") {
          if (node["@type"]) types.push(...[].concat(node["@type"]));
          if (node["@graph"]) walk(node["@graph"]);
        }
      };
      walk(data);
    } catch (error) {
      errors.push(String(error.message).slice(0, 120));
    }
  }
  return { types: [...new Set(types)], errors };
}

/** Internal links, as absolute site URLs without a hash. */
function internalLinks(html, pageUrl) {
  const links = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\shref=(?:"([^"]*)"|'([^']*)')/gi)) {
    const raw = decode(m[1] ?? m[2] ?? "");
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript):/i.test(raw)) continue;
    let u;
    try {
      u = new URL(raw, pageUrl);
    } catch {
      continue;
    }
    const origin = new URL(BASE).origin;
    const siteOrigin = new URL(SITE).origin;
    if (u.origin !== origin && u.origin !== siteOrigin) continue;
    u.hash = "";
    links.add(SITE + u.pathname.replace(/\/$/, "") + u.search || SITE);
  }
  return [...links].map((l) => (l === SITE ? SITE + "/" : l));
}

/** The page's visible text lines, without nav, header, footer, scripts, styles and svg. */
function textLines(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/pre|\/section|\/article|\/figcaption|\/td|\/th|\/dd|\/dt)\b[^>]*>/gi, "\n");
  s = decode(s.replace(/<[^>]+>/g, " "));
  return s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
}

const words = (line) => line.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Template key: the first one or two path segments. */
function template(path) {
  const segs = path.split("?")[0].split("/").filter(Boolean);
  if (segs.length === 0) return "/";
  if (segs[0] === "docs" && segs.length > 2) return `/docs/${segs[1]}/*`;
  if (segs.length === 1) return `/${segs[0]}`;
  return `/${segs[0]}/*`;
}

function analyse(url, res) {
  const html = res.body ?? "";
  const robotsMeta = metaContent(html, "name", "robots");
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const mainStart = html.search(/<main\b/i);
  const mainImgs = mainStart >= 0 ? html.slice(mainStart).match(/<img\b[^>]*>/gi) ?? [] : [];
  // The LCP candidate: the first image in main content that is not a small icon.
  const lcp = mainImgs.find((t) => {
    const w = Number(attr(t, "width") ?? "0");
    return !(w && w < 120) && !/aria-hidden="true"/.test(t);
  });
  const ld = jsonLd(html);
  const h1s = html.match(/<h1\b[\s\S]*?<\/h1>/gi) ?? [];
  return {
    url,
    status: res.status,
    error: res.error,
    redirects: res.chain?.map((c) => `${c.status} ${pathOf(c.url)}`) ?? [],
    ttfb: res.ttfb,
    bytes: res.bytes ?? 0,
    title: decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim()),
    description: metaContent(html, "name", "description"),
    robots: robotsMeta,
    xRobotsTag: res.headers?.get?.("x-robots-tag") ?? null,
    canonical: linkHref(html, "canonical"),
    h1Count: h1s.length,
    h1: decode((h1s[0] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
    ogImage: metaContent(html, "property", "og:image"),
    jsonLdTypes: ld.types,
    jsonLdErrors: ld.errors,
    images: imgs.length,
    imagesNoAlt: imgs.filter((t) => attr(t, "alt") === null).length,
    mzstatic: imgs.filter((t) => /mzstatic\.com/.test(t)).length,
    lcpImage: lcp ? attr(lcp, "src") : null,
    lcpLazy: lcp ? (attr(lcp, "loading") ?? "").toLowerCase() === "lazy" : false,
    cache: { cacheControl: res.headers?.get?.("cache-control") ?? null, cf: res.headers?.get?.("cf-cache-status") ?? null },
    links: internalLinks(html, url),
    lines: textLines(html),
  };
}

async function sitemapUrls(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const res = await timedFetch(toLocal(url), GOOGLEBOT);
  if (res.status !== 200) return [{ sitemap: url, error: res.status }];
  const xml = res.body;
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => decode(m[1]));
  if (/<sitemapindex\b/i.test(xml)) {
    const children = await Promise.all(locs.map((l) => sitemapUrls(l, seen)));
    return children.flat();
  }
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: decode(m[1].match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1] ?? ""),
    lastmod: m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null,
    priority: m[1].match(/<priority>([^<]+)<\/priority>/)?.[1] ?? null,
    images: [...m[1].matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((x) => decode(x[1])),
    sitemap: url,
  }));
  return entries;
}

function percentile(values, p) {
  const v = values.filter((x) => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
}

async function main() {
  const started = new Date().toISOString();
  console.log(`seo-check ${BASE} (site ${SITE})`);

  const robots = await timedFetch(`${BASE}/robots.txt`, GOOGLEBOT);
  const sitemapRefs = [...(robots.body ?? "").matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
  if (!sitemapRefs.length) sitemapRefs.push(`${SITE}/sitemap.xml`);
  const entries = (await Promise.all(sitemapRefs.map((s) => sitemapUrls(s)))).flat();
  const sitemapErrors = entries.filter((e) => e.error);
  const urlEntries = entries.filter((e) => e.loc).slice(0, LIMIT);
  const sitemapSet = new Set(urlEntries.map((e) => e.loc.replace(/\/$/, "") || e.loc));
  console.log(`sitemaps: ${sitemapRefs.length} referenced, ${urlEntries.length} URLs`);

  const byPrefix = {};
  for (const e of urlEntries) {
    const t = template(pathOf(e.loc));
    byPrefix[t] = (byPrefix[t] ?? 0) + 1;
  }
  const lastmodCounts = {};
  for (const e of urlEntries) lastmodCounts[e.lastmod ?? "(none)"] = (lastmodCounts[e.lastmod ?? "(none)"] ?? 0) + 1;

  // Fetch every sitemap URL as Googlebot (and as Chrome, to compare).
  let done = 0;
  const pages = await pool(urlEntries, async (e) => {
    const res = await timedFetch(toLocal(e.loc), GOOGLEBOT);
    const page = analyse(e.loc, res);
    if (DESKTOP) {
      const d = await timedFetch(toLocal(e.loc), CHROME);
      const dt = decode((d.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
      page.desktop = { status: d.status, ttfb: d.ttfb, bytes: d.bytes ?? 0, sameTitle: dt === page.title };
    }
    if (++done % 25 === 0) console.log(`  fetched ${done}/${urlEntries.length}`);
    return page;
  });
  const pageMap = new Map(pages.map((p) => [p.url.replace(/\/$/, "") || p.url, p]));

  // Crawl from home through <a href>, breadth first, reusing pages already fetched.
  const home = `${SITE}/`;
  const depth = new Map([[home, 0]]);
  let frontier = [home];
  const crawlCache = new Map();
  const getLinks = async (url) => {
    const key = url.replace(/\/$/, "") || url;
    if (pageMap.has(key)) return pageMap.get(key).links;
    if (url === home && pageMap.has(SITE)) return pageMap.get(SITE).links;
    if (crawlCache.has(url)) return crawlCache.get(url);
    const res = await timedFetch(toLocal(url), GOOGLEBOT);
    const ok = res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/html");
    const links = ok ? internalLinks(res.body, url) : [];
    crawlCache.set(url, links);
    return links;
  };
  while (frontier.length && depth.size < CRAWL_MAX) {
    const next = [];
    const linkLists = await pool(frontier, getLinks);
    for (let i = 0; i < frontier.length; i++) {
      const d = depth.get(frontier[i]);
      for (const l of linkLists[i]) {
        // Skip machine routes and files: only pages count toward depth.
        const p = pathOf(l);
        if (/^\/(api|r)\//.test(p) || /\.(json|xml|txt|png|webp|jpg|svg|ico|mp4|webm|zip)(\?|$)/.test(p)) continue;
        if (!depth.has(l)) {
          depth.set(l, d + 1);
          next.push(l);
        }
      }
    }
    frontier = next;
  }
  const depthOf = (url) => depth.get(url) ?? depth.get(url.replace(/\/$/, "")) ?? depth.get(url + "/");

  // Unique words: drop lines shared by half or more of the pages in the same template.
  const groups = {};
  for (const p of pages) (groups[template(pathOf(p.url))] ??= []).push(p);
  for (const group of Object.values(groups)) {
    const count = new Map();
    for (const p of group) for (const l of new Set(p.lines)) count.set(l, (count.get(l) ?? 0) + 1);
    const cutoff = Math.max(2, group.length * 0.5);
    for (const p of group) {
      const shared = (l) => group.length > 1 && (count.get(l) ?? 0) >= cutoff;
      p.uniqueWords = p.lines.filter((l) => !shared(l)).reduce((n, l) => n + words(l), 0);
    }
  }

  // Duplicates.
  const dupe = (key) => {
    const m = new Map();
    for (const p of pages) if (p[key]) m.set(p[key], [...(m.get(p[key]) ?? []), p.url]);
    return [...m.entries()].filter(([, urls]) => urls.length > 1).map(([value, urls]) => ({ value, urls }));
  };
  const duplicateTitles = dupe("title");
  const duplicateDescriptions = dupe("description");
  const siteOg = (() => {
    const m = new Map();
    for (const p of pages) if (p.ogImage) m.set(p.ogImage.split("?")[0], (m.get(p.ogImage.split("?")[0]) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  })();

  const flags = [];
  const add = (url, kind, blocker, detail) => flags.push({ url: pathOf(url), kind, blocker, ...(detail !== undefined ? { detail } : {}) });
  for (const p of pages) {
    const path = pathOf(p.url);
    if (p.status !== 200) add(p.url, "non-200", true, p.status || p.error);
    if (p.redirects.length) add(p.url, "redirect", true, p.redirects.join(" > "));
    if (p.status === 200 && p.canonical && p.canonical.replace(/\/$/, "") !== p.url.replace(/\/$/, "")) add(p.url, "canonical-mismatch", true, p.canonical);
    if (p.status === 200 && !p.canonical) add(p.url, "canonical-missing", false);
    if (/noindex/i.test(p.robots ?? "") || /noindex/i.test(p.xRobotsTag ?? "")) add(p.url, "noindex-in-sitemap", true, p.robots ?? p.xRobotsTag);
    if (p.jsonLdErrors.length) add(p.url, "jsonld-parse-error", true, p.jsonLdErrors);
    if (p.h1Count > 1) add(p.url, "multiple-h1", false, p.h1Count);
    if (p.h1Count === 0 && p.status === 200) add(p.url, "no-h1", false);
    const d = depthOf(p.url);
    if (d === undefined) add(p.url, "orphan", true);
    else if (d > 3) add(p.url, "deep", false, d);
    if (ITEM_TYPES.some((r) => r.test(path))) {
      const hasOwnImage = p.ogImage && p.ogImage.split("?")[0] !== siteOg;
      if (p.uniqueWords < (hasOwnImage ? THIN_WORDS_WITH_IMAGE : THIN_WORDS)) add(p.url, "thin", false, p.uniqueWords);
    }
    if (OWN_IMAGE_TYPES.some((r) => r.test(path)) && p.ogImage && p.ogImage.split("?")[0] === siteOg) add(p.url, "og-image-is-site-default", false);
    if (p.lcpLazy) add(p.url, "lcp-image-lazy", false, p.lcpImage);
    if (p.mzstatic) add(p.url, "mzstatic-hotlink", false, p.mzstatic);
    if (p.imagesNoAlt) add(p.url, "images-without-alt", false, p.imagesNoAlt);
  }
  for (const d of duplicateTitles) for (const u of d.urls) add(u, "duplicate-title", false, d.value);
  for (const d of duplicateDescriptions) for (const u of d.urls) add(u, "duplicate-description", false, d.value);

  const kinds = {};
  for (const f of flags) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  const blockers = flags.filter((f) => f.blocker);
  const ttfbs = pages.map((p) => p.ttfb);
  const depths = pages.map((p) => depthOf(p.url)).filter((d) => d !== undefined);
  const uniqueByTemplate = Object.fromEntries(
    Object.entries(groups).map(([t, g]) => {
      const u = g.map((p) => p.uniqueWords).sort((a, b) => a - b);
      return [t, { pages: g.length, medianUniqueWords: u[Math.floor(u.length / 2)] }];
    }),
  );
  const lastmodTop = Object.entries(lastmodCounts).sort((a, b) => b[1] - a[1])[0];

  const summary = {
    base: BASE,
    site: SITE,
    started,
    finished: new Date().toISOString(),
    robotsStatus: robots.status,
    robots: robots.body?.slice(0, 2000),
    sitemaps: sitemapRefs,
    sitemapErrors,
    urls: urlEntries.length,
    urlsByTemplate: byPrefix,
    lastmod: { distinct: Object.keys(lastmodCounts).length, mostCommon: lastmodTop ? { value: lastmodTop[0], urls: lastmodTop[1], share: +(lastmodTop[1] / urlEntries.length).toFixed(3) } : null },
    sitemapPriority: urlEntries.filter((e) => e.priority).length,
    sitemapImages: urlEntries.reduce((n, e) => n + e.images.length, 0),
    ttfb: { p50: percentile(ttfbs, 50), p90: percentile(ttfbs, 90), max: percentile(ttfbs, 100) },
    depth: { max: depths.length ? Math.max(...depths) : null, crawled: depth.size },
    orphans: kinds.orphan ?? 0,
    blockers: blockers.length,
    flagsByKind: kinds,
    uniqueWordsByTemplate: uniqueByTemplate,
    siteDefaultOgImage: siteOg,
    mzstaticImages: pages.reduce((n, p) => n + p.mzstatic, 0),
    duplicateTitles: duplicateTitles.length,
    duplicateDescriptions: duplicateDescriptions.length,
  };

  const report = {
    summary,
    flags,
    pages: pages.map(({ lines, links, ...p }) => ({ ...p, depth: depthOf(p.url) ?? null, internalLinks: links.length, sitemapUrl: sitemapSet.has(p.url.replace(/\/$/, "") || p.url) })),
    sitemap: urlEntries,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const host = new URL(BASE).host.replace(/[^a-z0-9.-]/gi, "_");
  const suffix = host === new URL(SITE).host ? "" : `-${host}`;
  const jsonPath = `${OUT_DIR}/report-${DATE}${suffix}.json`;
  const mdPath = `${OUT_DIR}/report-${DATE}${suffix}.md`;
  await writeFile(jsonPath, JSON.stringify(report, null, 1) + "\n");

  const md = [
    `# SEO check, ${DATE}`,
    "",
    `Base: ${BASE}. Sitemap URLs: ${summary.urls}. Blockers: ${summary.blockers}. Orphans: ${summary.orphans}. Max click depth: ${summary.depth.max}.`,
    "",
    `TTFB (Googlebot UA, from the machine that ran the check): p50 ${summary.ttfb.p50} ms, p90 ${summary.ttfb.p90} ms, max ${summary.ttfb.max} ms.`,
    "",
    `lastmod: ${summary.lastmod.distinct} distinct values; the most common (${summary.lastmod.mostCommon?.value}) is on ${summary.lastmod.mostCommon?.urls} URLs (${Math.round((summary.lastmod.mostCommon?.share ?? 0) * 100)}%). URLs with priority: ${summary.sitemapPriority}. Image entries: ${summary.sitemapImages}.`,
    "",
    `App Store (mzstatic.com) images in sitemap pages: ${summary.mzstaticImages}. Duplicate titles: ${summary.duplicateTitles}. Duplicate descriptions: ${summary.duplicateDescriptions}.`,
    "",
    "## URLs by template",
    "",
    "| Template | URLs | Median unique words |",
    "|---|---:|---:|",
    ...Object.entries(uniqueByTemplate)
      .sort((a, b) => b[1].pages - a[1].pages)
      .map(([t, v]) => `| \`${t}\` | ${v.pages} | ${v.medianUniqueWords} |`),
    "",
    "## Flags",
    "",
    "| Flag | Pages | Blocker |",
    "|---|---:|---|",
    ...Object.entries(kinds)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `| ${k} | ${n} | ${flags.find((f) => f.kind === k)?.blocker ? "yes" : ""} |`),
    "",
    ...(blockers.length ? ["## Blockers", "", ...blockers.slice(0, 50).map((f) => `- ${f.kind}: \`${f.url}\`${f.detail !== undefined ? ` (${JSON.stringify(f.detail)})` : ""}`), ""] : []),
  ].join("\n");
  await writeFile(mdPath, md + "\n");

  console.log(md);
  console.log(`\nwrote ${jsonPath} and ${mdPath}`);
  process.exit(blockers.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
