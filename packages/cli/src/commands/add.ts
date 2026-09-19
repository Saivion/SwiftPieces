import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { DEFAULT_REGISTRIES, findConfig, readLicenseKey } from "../config.js";
import { fetchItem, RegistryError, type RegistryItem } from "../registry.js";
import { fetchKitItem, isKitId, resolveAgents, skillsDir, writeKit } from "../kit.js";
import { init } from "./init.js";
import { detectXcodeProject } from "../xcode.js";

const PREFIX = "SwiftPieces/";

type AddOptions = { overwrite?: boolean; dryRun?: boolean; agent?: string; global?: boolean };

export async function add(all: string[], opts: AddOptions) {
  const kitIds = all.filter(isKitId);
  const names = all.filter((n) => !isKitId(n));
  if (kitIds.length) {
    const ok = await addKit(kitIds, opts);
    if (!ok || !names.length) return;
    console.log("");
  }
  let found = findConfig();
  if (!found) {
    // First run in this project: set it up, then carry on with the add.
    await init({});
    console.log("");
    found = findConfig();
    if (!found) {
      console.error("Couldn't create swiftpieces.json here. Run `npx swiftpieces init` in your project root.");
      process.exitCode = 1;
      return;
    }
  }
  const { config, path: configPath } = found;
  const root = dirname(configPath);
  const baseDir = join(root, config.directory);
  const licenseKey = readLicenseKey();

  const resolved = new Map<string, { item: RegistryItem; source: "free" | "pro" }>();
  const queue = [...names];
  while (queue.length) {
    const name = queue.shift()!;
    if (resolved.has(name)) continue;
    try {
      const r = await fetchItem(config.registries, name, licenseKey);
      resolved.set(r.item.name, r);
      for (const dep of r.item.registryDependencies) if (!resolved.has(dep)) queue.push(dep);
    } catch (e) {
      console.error(e instanceof RegistryError ? e.message : String(e));
      process.exitCode = 1;
      return;
    }
  }

  const written: string[] = [];
  const skipped: string[] = [];
  for (const { item, source } of resolved.values()) {
    if (compareVersions(item.minIOSVersion, config.minIOSVersion) > 0) {
      console.log(`note: ${item.name} needs iOS ${item.minIOSVersion}+ (your project minimum is ${config.minIOSVersion}); it gates newer APIs with #available.`);
    }
    for (const file of [...item.files, ...(item.shaders ?? []), ...(item.assets ?? [])]) {
      const rel = file.target.startsWith(PREFIX) ? file.target.slice(PREFIX.length) : file.target;
      const dest = join(baseDir, rel);
      const display = relative(root, dest);
      if (existsSync(dest) && !opts.overwrite) {
        skipped.push(display);
        continue;
      }
      if (file.content === undefined) {
        console.error(`${item.name}: the ${source} registry did not return content for ${file.target}`);
        process.exitCode = 1;
        return;
      }
      if (!opts.dryRun) {
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, file.content);
      }
      written.push(`${display}${source === "pro" ? "  (pro)" : ""}`);
    }
  }

  for (const f of written) console.log(`${opts.dryRun ? "would write" : "wrote"}  ${f}`);
  for (const f of skipped) console.log(`skipped ${f} (exists; use --overwrite)`);

  const requirements: string[] = [];
  for (const { item } of resolved.values()) {
    for (const c of item.requiredCapabilities ?? []) requirements.push(`${item.name}: enable capability ${c}`);
    for (const [k, v] of Object.entries(item.infoPlist ?? {})) requirements.push(`${item.name}: add Info.plist ${k} = "${v}"`);
    for (const d of item.spmDependencies ?? []) requirements.push(`${item.name}: add Swift package ${d.url} (from ${d.from})`);
  }
  if (requirements.length) {
    console.log("\nProject requirements (not applied automatically):");
    for (const r of requirements) console.log(`  - ${r}`);
  }
  if (written.length && !opts.dryRun) {
    const files = `${written.length} file${written.length === 1 ? "" : "s"} in ./${config.directory}/`;
    console.log(detectXcodeProject(root)
      ? `\nDone. ${files}. Build in Xcode 16+; synchronized folders pick them up automatically.`
      : `\nDone. ${files}. Drag that folder into your app in Xcode to use them.`);
  }
}

/**
 * Build Kit items go to the coding agent, not the SwiftPieces folder, so they work without
 * swiftpieces.json. The setup skill is free; the rest need the Pro license.
 */
async function addKit(ids: string[], opts: AddOptions): Promise<boolean> {
  const found = findConfig();
  const root = found ? dirname(found.path) : process.cwd();
  const registries = found?.config.registries ?? DEFAULT_REGISTRIES;
  const licenseKey = readLicenseKey();
  try {
    const agents = resolveAgents(root, opts.agent);
    const dirs = agents.map((a) => skillsDir(root, a, Boolean(opts.global)));
    const pieces = new Set<string>();
    for (const id of ids) {
      const item = await fetchKitItem(registries.pro, id, licenseKey);
      const { written, skipped } = writeKit(item, dirs, root, opts);
      for (const f of written) console.log(`${opts.dryRun ? "would write" : "wrote"}  ${f}  (${item.kind})`);
      for (const f of skipped) console.log(`skipped ${f} (exists; use --overwrite)`);
      if (item.kind === "recipe") for (const u of item.uses) pieces.add(u);
    }
    console.log(`\nBuild Kit: ${ids.length} item${ids.length === 1 ? "" : "s"} for ${agents.join(", ")}. Restart your agent so it picks up new skills.`);
    if (pieces.size) console.log(`The recipe assembles library screens. Add them with:\n  npx swiftpieces add ${[...pieces].join(" ")}`);
    return true;
  } catch (e) {
    console.error(e instanceof RegistryError ? e.message : String(e));
    process.exitCode = 1;
    return false;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
