import assert from "node:assert/strict";
import { describe, it } from "node:test";
import knownPagesManifest from "../registry/__registry__/known-pages.json";
import { appSlugs } from "./apps/slugs";
import { changelog, changelogPath } from "./changelog";
import { hubs, hubPath } from "./hubs";
import { isKnownPage, knownPageSets, type KnownPages } from "./known-pages";

const k = knownPageSets({
  docs: ["introduction", "components", "components/cards/parallax-card", "blocks", "guides/theming"],
  docsSections: ["components", "guides", "blocks", "cards"],
  registry: ["index", "ParallaxCard", "parallax-card"],
  pieces: ["ParallaxCard", "parallax-card"],
  hubs: ["text", "backgrounds", "glass"],
  apps: ["lungy", "tiimo"],
});

describe("isKnownPage", () => {
  it("answers every page, registry name and legacy forward", () => {
    for (const path of [
      "/docs/introduction", "/docs/components/cards/parallax-card", "/docs/guides/theming", "/docs/components/ParallaxCard",
      "/r/index.json", "/r/ParallaxCard.json", "/api/registry/parallax-card", "/api/registry/ParallaxCard.json",
      "/", "/apps", "/api/search", "/r/anything-else", "/api/registry",
      "/components", "/components/text", "/apps/lungy", "/playground/lungy", "/playground/open",
    ]) assert.equal(isKnownPage(path, k), true, path);
  });

  it("refuses made-up docs pages and registry names", () => {
    for (const path of [
      "/docs/zz", "/docs/zz/ParallaxCard", "/docs/components/zz", "/docs/a/b/ParallaxCard", "/docs/components/cards/zz",
      "/r/zz.json", "/api/registry/zz", "/docs/%E0%A4%A",
      "/components/zz", "/apps/zz", "/playground/zz",
    ]) assert.equal(isKnownPage(path, k), false, path);
  });
});

// A hub or an app missing from the manifest is answered by middleware.ts as a made-up URL, so its
// real page would 404. scripts/build-registry.ts writes it; run `npm run registry:build` after a
// change to lib/hubs.ts or lib/apps/library.ts.
describe("the committed manifest", () => {
  const manifest = knownPageSets(knownPagesManifest as KnownPages);

  it("lists every hub and every app the routes render", () => {
    assert.deepEqual([...manifest.hubs].sort(), hubs.map((h) => h.slug).sort());
    assert.deepEqual([...manifest.apps].sort(), [...appSlugs].sort());
  });

  it("answers every hub, app and playground page, and the changelog's", () => {
    for (const path of [...hubs.map((h) => hubPath(h.slug)), ...appSlugs.flatMap((slug) => [`/apps/${slug}`, `/playground/${slug}`]), "/playground/open"]) {
      assert.equal(isKnownPage(path, manifest), true, path);
    }
    for (const entry of changelog) assert.equal(isKnownPage(changelogPath(entry.slug), manifest), true, entry.slug);
  });
});
