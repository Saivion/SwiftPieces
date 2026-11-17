#!/usr/bin/env node
/**
 * Tell IndexNow (Bing, Yandex, Seznam, Naver and others; Google does not use it) which pages changed.
 *
 *   npm run indexnow -- --since <git ref>   # pages whose lastmod changed or that are new since <ref>
 *   npm run indexnow -- --all               # every dated page
 *   npm run indexnow -- --since HEAD~1 --dry-run
 *
 * Run it after a deploy is live, for example as the last step of the deploy command:
 *   npx wrangler deploy && npm run indexnow -- --since HEAD~1
 *
 * Changed pages come from registry/__registry__/lastmod.json (npm run seo:lastmod), compared with the
 * same file at <ref>. The key is public by design: IndexNow checks that https://swiftpieces.com/<key>.txt
 * serves it, which proves the submitter controls the host.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const KEY = "5f0c85f51f57ba05f8d86ceeea21eb09";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://swiftpieces.com").replace(/\/$/, "");
const FILE = "registry/__registry__/lastmod.json";

const args = process.argv.slice(2);
const since = args.includes("--since") ? args[args.indexOf("--since") + 1] : null;
const all = args.includes("--all");
const dry = args.includes("--dry-run");
if (!since && !all) {
  console.error("usage: indexnow --since <git ref> | --all [--dry-run]");
  process.exit(2);
}

const now = JSON.parse(readFileSync(FILE, "utf8"));
let before = {};
if (since) {
  try {
    before = JSON.parse(execFileSync("git", ["show", `${since}:${FILE}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    before = {};
  }
}
const paths = Object.keys(now).filter((p) => all || now[p] !== before[p]);
const urls = paths.map((p) => `${SITE}${p === "/" ? "" : p}`);
if (!urls.length) {
  console.log("indexnow: nothing changed");
  process.exit(0);
}
console.log(`indexnow: ${urls.length} URL(s)`);
for (const u of urls.slice(0, 20)) console.log(`  ${u}`);
if (urls.length > 20) console.log(`  ...and ${urls.length - 20} more`);
if (dry) process.exit(0);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log(`indexnow: ${res.status} ${res.statusText}`);
process.exit(res.ok || res.status === 202 ? 0 : 1);
