// Runs every committed test and fails when there are none. A glob that matches nothing used to
// make `npm test` exit 0.
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const roots = ["packages/cli/test", "packages/builder/test", "lib"];
const files = [];

function walk(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) files.push(path);
  }
}

for (const root of roots) walk(root);
if (files.length === 0) {
  console.error("npm test found 0 tests.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
process.exit(result.status === null ? 1 : result.status);
