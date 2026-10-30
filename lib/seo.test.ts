import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import dates from "../registry/__registry__/lastmod.json";
import { AI_CRAWLERS } from "./crawlers";
import { choosingFaqs } from "./choosing";
import { homeFaqs } from "./faqs";
import { proCatalog } from "./pro-catalog";
import { getRegistryIndex, piecePath } from "./registry";
import { breadcrumbJsonLd } from "./seo";
import { homeStructuredData, nodesOf, pieceBreadcrumbTrail, ratingKeys } from "./structured-data";
import { libraryLead } from "./site";

const root = new URL("..", import.meta.url);

test("home graph is a free app with the visible FAQs and no rating", () => {
  const count = getRegistryIndex().length;
  const questions = homeFaqs(count, proCatalog);
  const data = homeStructuredData(count, questions, libraryLead);
  assert.deepEqual(ratingKeys(data), []);
  const apps = nodesOf(data, "SoftwareApplication");
  assert.equal(apps.length, 1);
  const offer = apps[0].offers as { price: string; priceCurrency: string };
  assert.equal(offer.price, "0");
  assert.equal(offer.priceCurrency, "USD");
  assert.equal(apps[0].isAccessibleForFree, true);
  assert.equal(apps[0].description, libraryLead);
  const faqs = nodesOf(data, "FAQPage");
  const main = faqs[0].mainEntity as { name: string; acceptedAnswer: { text: string } }[];
  assert.deepEqual(main.map((q) => q.name), questions.map((q) => q.q));
  assert.deepEqual(main.map((q) => q.acceptedAnswer.text), questions.map((q) => q.a));
  const code = nodesOf(data, "SoftwareSourceCode");
  assert.equal((code[0].targetProduct as { "@id": string })["@id"], apps[0]["@id"]);
});

test("a component page breadcrumb lists home, the library, the category, and the piece", () => {
  const item = getRegistryIndex().find((entry) => entry.name === "SwipeDeck") ?? getRegistryIndex()[0];
  const list = breadcrumbJsonLd(pieceBreadcrumbTrail(item, piecePath(item))).itemListElement;
  assert.equal(list.length, 4);
  list.forEach((entry, i) => {
    assert.equal(entry["@type"], "ListItem");
    assert.equal(entry.position, i + 1);
    assert.ok(entry.name);
    assert.match(entry.item, /^https:\/\/swiftpieces\.com\//);
  });
  assert.equal(list[1].name, "Components");
  assert.equal(list[3].name, item.title);
});

test("robots names the AI crawlers and still hides /api/", () => {
  const rules = robots().rules;
  const list = Array.isArray(rules) ? rules : [rules];
  const named = list.find((rule) => Array.isArray(rule.userAgent) && rule.userAgent.includes("GPTBot"));
  assert.ok(named);
  for (const bot of AI_CRAWLERS) assert.ok((named.userAgent as string[]).includes(bot), bot);
  assert.equal(named.allow, "/");
  assert.deepEqual(named.disallow, ["/api/"]);
  const star = list.find((rule) => rule.userAgent === "*");
  assert.ok(star);
  assert.deepEqual(star.disallow, ["/api/"]);
});

test("sitemap lastmod covers component and docs pages", () => {
  const map = dates as Record<string, string>;
  for (const entry of sitemap()) {
    const path = new URL(entry.url).pathname;
    assert.ok(map[path], `missing lastmod for ${path}; run npm run aeo:lastmod`);
    assert.ok(entry.lastModified instanceof Date && !Number.isNaN(entry.lastModified.getTime()));
  }
  assert.ok(map["/docs/choosing"]);
  assert.ok(Object.keys(map).some((path) => path.startsWith("/docs/components/")));
});

test("the choosing page prints every FAQ the schema would quote", () => {
  const mdx = readFileSync(new URL("content/docs/choosing.mdx", root), "utf8");
  for (const faq of choosingFaqs) {
    assert.ok(mdx.includes(faq.q), faq.q);
    assert.ok(mdx.includes(faq.a), faq.a);
  }
});

test("AEO copy does not use em or en dashes", () => {
  const files = [
    "docs/aeo/buyer-question-map.md",
    "docs/aeo/source-map.md",
    "content/docs/choosing.mdx",
    "content/docs/introduction.mdx",
    "content/docs/installation.mdx",
    "content/docs/cli.mdx",
    "content/docs/mcp.mdx",
    "content/docs/liquid-glass.mdx",
    "lib/choosing.ts",
    "scripts/aeo/README.md",
    "scripts/aeo/prompts.json",
    "README.md",
    "packages/cli/README.md",
  ];
  for (const file of files) {
    const text = readFileSync(new URL(file, root), "utf8");
    assert.equal(/[\u2013\u2014]/.test(text), false, file);
  }
});

test("the manual tracker records no measured yes or no", () => {
  const dir = mkdtempSync(join(tmpdir(), "aeo-"));
  const result = spawnSync(process.execPath, ["scripts/aeo/track.mjs", "--manual", "--out", dir], { cwd: root.pathname, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const jsonName = readdirSync(dir).find((name) => name.endsWith(".json"));
  assert.ok(jsonName);
  const rows = JSON.parse(readFileSync(join(dir, jsonName), "utf8")) as { channel: string; google_presence: string; ai_mention: string; ai_citation: string; notes: string }[];
  assert.ok(rows.some((row) => row.channel === "google"));
  assert.ok(rows.some((row) => row.channel === "ai"));
  for (const row of rows) {
    assert.equal(row.google_presence, "");
    assert.equal(row.ai_mention, "");
    assert.equal(row.ai_citation, "");
    assert.match(row.notes, /manual checklist/);
  }
});
