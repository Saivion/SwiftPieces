import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildCatalogProject, createRegistry, freeDefinitions, generateProject, validateProject } from "../src/index.js";
import { patternsCatalogSource } from "../src/definitions/catalog/index.js";
import { FREE_RECREATIONS, recreationBuilds, recreationEntries } from "../src/definitions/catalog/recreations/index.js";

const recreationsDir = join(dirname(fileURLToPath(import.meta.url)), "../src/definitions/catalog/recreations");
const buildFiles = readdirSync(recreationsDir).filter((name) => name.endsWith(".build.ts")).map((name) => name.slice(0, -".build.ts".length)).sort();
const freeSlugs = [...FREE_RECREATIONS].sort();

describe("patterns", () => {
  it("ships a build only for the free recreations", () => {
    assert.deepEqual(buildFiles, freeSlugs);
    assert.deepEqual(Object.keys(recreationBuilds).sort(), freeSlugs);
    const pro = recreationEntries.filter((entry) => entry.availability === "pro");
    assert.ok(pro.length > 0);
    for (const entry of pro) {
      assert.equal(buildFiles.includes(entry.slug), false);
      assert.equal(recreationBuilds[entry.slug], undefined);
    }
  });

  it("loads no Pro build from this package", async () => {
    const pro = recreationEntries.filter((entry) => entry.availability === "pro");
    for (const entry of pro) {
      assert.equal(await patternsCatalogSource.load(entry), null);
    }
  });

  it("builds every free pattern clean", async () => {
    const registry = createRegistry(freeDefinitions);
    for (const slug of FREE_RECREATIONS) {
      const entry = recreationEntries.find((candidate) => candidate.slug === slug);
      assert.ok(entry, slug);
      assert.equal(entry.availability, "free");
      const build = await patternsCatalogSource.load(entry);
      assert.ok(build, `${slug} has no build`);
      const project = buildCatalogProject(entry, build, registry);
      const checked = validateProject(project, registry);
      assert.deepEqual(checked.issues, [], `${slug}: ${checked.issues.join("; ")}`);
      const generated = generateProject(checked.value, registry);
      assert.ok(generated.files.length > 0, `${slug} generated no Swift files`);
      assert.ok(generated.files.every((file) => file.content.includes("struct ")), `${slug} generated a file without a type`);
    }
  });
});
