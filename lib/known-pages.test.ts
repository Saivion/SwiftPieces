import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isKnownPage, knownPageSets } from "./known-pages";

const k = knownPageSets({
  docs: ["introduction", "components", "components/cards/parallax-card", "blocks", "guides/theming"],
  docsSections: ["components", "guides", "blocks", "cards"],
  registry: ["index", "ParallaxCard", "parallax-card"],
  pieces: ["ParallaxCard", "parallax-card"],
});

describe("isKnownPage", () => {
  it("answers every page, registry name and legacy forward", () => {
    for (const path of [
      "/docs/introduction", "/docs/components/cards/parallax-card", "/docs/guides/theming", "/docs/components/ParallaxCard",
      "/r/index.json", "/r/ParallaxCard.json", "/api/registry/parallax-card", "/api/registry/ParallaxCard.json",
      "/", "/apps", "/api/search", "/r/anything-else", "/api/registry",
    ]) assert.equal(isKnownPage(path, k), true, path);
  });

  it("refuses made-up docs pages and registry names", () => {
    for (const path of [
      "/docs/zz", "/docs/zz/ParallaxCard", "/docs/components/zz", "/docs/a/b/ParallaxCard", "/docs/components/cards/zz",
      "/r/zz.json", "/api/registry/zz", "/docs/%E0%A4%A",
    ]) assert.equal(isKnownPage(path, k), false, path);
  });
});
