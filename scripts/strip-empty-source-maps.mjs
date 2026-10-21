// Turbopack writes an empty, unreferenced source map beside a web worker's entry (the hero ribbon's,
// components/visual/hero-lines.worker.ts) even with browser source maps off. It holds no source, but
// scripts/audit-public.sh rightly fails on any .map file, so the empty ones are removed after the
// build (`postbuild`, which runs inside OpenNext's build before it copies the assets). A map with
// sources in it is left alone, so a real one still fails the audit. SwiftPieces Pro runs the same script.
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const empty = (map) => !(map.sources?.length || map.sections?.some((s) => s.map?.sources?.length));

function* maps(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* maps(path);
    else if (name.endsWith(".map")) yield path;
  }
}

for (const dir of [".next/static", ".open-next/assets"]) {
  try {
    statSync(dir);
  } catch {
    continue;
  }
  for (const path of maps(dir)) {
    let map;
    try {
      map = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue;
    }
    if (empty(map)) {
      rmSync(path);
      console.log(`removed empty source map ${path}`);
    }
  }
}
