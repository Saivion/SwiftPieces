import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { computeCacheKey } from "@opennextjs/cloudflare/overrides/internal";

/**
 * The ISR cache's retention, which lives outside the code: an R2 lifecycle rule on the cache bucket
 * (README › "ISR cache retention"). OpenNext keys every entry by build ID and R2 has no per-object
 * expiry, so without the rule each deploy's copy of the site stays in R2 for good.
 *
 * These checks keep the rule and the code agreeing: the rule's prefix still covers every key OpenNext
 * writes, no page revalidates on a cycle the rule would cut short, and the cache never moves into the
 * VIEWS KV namespace, whose keys are kept on purpose.
 */

const ROOT = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** What the README tells the maintainer to apply. Change both together. */
const BUCKET = "swiftpieces-cache";
const PREFIX = "incremental-cache/";
const EXPIRE_DAYS = 7;

describe("ISR cache retention", () => {
  it("documents the lifecycle rule with the bucket, prefix and age used here", () => {
    assert.match(read("README.md"), new RegExp(`wrangler r2 bucket lifecycle add ${BUCKET} \\S+ ${PREFIX} --expire-days ${EXPIRE_DAYS}\\b`));
  });

  it("keeps the incremental cache in that R2 bucket, never in KV", () => {
    const config = read("open-next.config.ts");
    assert.match(config, /overrides\/incremental-cache\/r2-incremental-cache/);
    // OpenNext's KV cache writes without a TTL, and a lifecycle rule can't reach KV. Moving the cache
    // there needs expiry of its own first.
    assert.doesNotMatch(config, /kv-incremental-cache|kv-next-tag-cache/);

    const wrangler = read("wrangler.jsonc");
    assert.match(wrangler, new RegExp(`"binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "${BUCKET}"`));
    assert.doesNotMatch(wrangler, /NEXT_INC_CACHE_KV/);
    // A custom prefix would move every key out from under the rule.
    assert.doesNotMatch(wrangler, /NEXT_INC_CACHE_R2_PREFIX/);
  });

  it("covers every key the installed OpenNext writes, pages and fetches alike", () => {
    for (const cacheType of ["cache", "fetch", "composable"] as const) {
      const key = computeCacheKey("/route-cache/APP_PAGE/abc/$/index", { prefix: undefined, buildId: "build-1", cacheType });
      assert.ok(key.startsWith(`${PREFIX}build-1/`), key);
    }
    // Without a build ID (local runs) the keys still sit under the prefix.
    assert.ok(computeCacheKey("/x", { prefix: undefined, buildId: undefined }).startsWith(PREFIX));
  });

  it("only revalidates on cycles well inside the rule's age", () => {
    // An entry is rewritten, so its age resets, each time it regenerates. Keeping every cycle under
    // half the rule's age leaves a stale entry a full cycle in which to be served while it regenerates.
    const limit = (EXPIRE_DAYS * 86_400) / 2;
    const found: string[] = [];
    for (const dir of ["app", "lib"]) {
      for (const file of walk(join(ROOT, dir))) {
        for (const [, seconds] of readFileSync(file, "utf8").matchAll(/(?<![-\w])revalidate\s*[=:]\s*(\d+)/g)) {
          found.push(file);
          assert.ok(Number(seconds) <= limit, `${file}: revalidate ${seconds}s is longer than ${limit}s`);
        }
      }
    }
    assert.ok(found.length > 0, "expected the ISR pages' revalidate settings to be found");
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}
