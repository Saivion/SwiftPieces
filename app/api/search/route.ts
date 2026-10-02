import type { StructuredData } from "fumadocs-core/mdx-plugins";
import { createSearchAPI } from "fumadocs-core/search/server";
import docs from "@/registry/__registry__/docs.json";

// The docs search, from the index scripts/build-registry.ts prebuilds (the same titles, text and
// breadcrumbs fumadocs' createFromSource builds). Never import lib/source.ts here: it is the compiled
// MDX (about 20 MB), and a copy for this route is what pushed the Worker past Cloudflare's 64 MiB limit.
export const { GET } = createSearchAPI("advanced", {
  language: "english",
  indexes: docs.map((page) => ({ ...page, id: page.url, structuredData: page.structuredData as StructuredData })),
});
