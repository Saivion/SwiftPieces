import { dirname, relative } from "node:path";
import { DEFAULT_REGISTRIES, findConfig, readLicenseKey } from "../config.js";
import { fetchItem, RegistryError, type FetchPolicy, type RegistryItem } from "../registry.js";
import { fetchKitItem, isKitId, resolveAgents, skillsDir, writeKit } from "../kit.js";
import { init } from "./init.js";
import { detectXcodeProject } from "../xcode.js";
import { existingRegularFile, mkdirInside, PathEscapeError, resolveInside, writeInside } from "../safe-path.js";

const PREFIX = "SwiftPieces/";

export type AddOptions = {
  overwrite?: boolean;
  dryRun?: boolean;
  agent?: string;
  global?: boolean;
  allowHttpLocalhost?: boolean;
  trustRegistry?: boolean;
};

function policyOf(opts: AddOptions): FetchPolicy {
  return { allowHttpLocalhost: opts.allowHttpLocalhost, trustRegistry: opts.trustRegistry };
}

function fail(error: unknown): false {
  console.error(error instanceof RegistryError || error instanceof PathEscapeError ? error.message : String(error));
  process.exitCode = 1;
  return false;
}

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
    await init({ allowHttpLocalhost: opts.allowHttpLocalhost });
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
  let baseDir: string;
  try {
    baseDir = resolveInside(root, config.directory);
  } catch (error) {
    fail(error);
    return;
  }
  const licenseKey = readLicenseKey();
  const policy = policyOf(opts);

  // Free pieces name their pieces in `registryDependencies`; a Pro item also names its Pro dependencies by id in
  // `dependencies` (every themed screen, block and template needs "design-system"). Both install with it. A
  // dependency is requested by id but resolved by name, so `requested` is what has been asked for, by either.
  const resolved = new Map<string, { item: RegistryItem; source: "free" | "pro" }>();
  const requested = new Set<string>(names);
  const queue = [...names];
  while (queue.length) {
    const name = queue.shift()!;
    if (resolved.has(name)) continue;
    try {
      const r = await fetchItem(config.registries, name, licenseKey, policy);
      resolved.set(r.item.name, r);
      const deps = [...r.item.registryDependencies, ...(r.source === "pro" ? r.item.dependencies : [])];
      for (const dep of deps) {
        if (resolved.has(dep) || requested.has(dep)) continue;
        requested.add(dep);
        queue.push(dep);
      }
    } catch (error) {
      fail(error);
      return;
    }
  }

  type Planned = { item: RegistryItem; source: "free" | "pro"; rel: string; display: string; content: string };
  const planned: Planned[] = [];
  const skipped: string[] = [];
  try {
    if (!opts.dryRun) mkdirInside(root, baseDir);
    for (const { item, source } of resolved.values()) {
      if (compareVersions(item.minIOSVersion, config.minIOSVersion) > 0) {
        console.log(`note: ${item.name} needs iOS ${item.minIOSVersion}+ (your project minimum is ${config.minIOSVersion}); it gates newer APIs with #available.`);
      }
      for (const file of [...item.files, ...item.shaders, ...item.assets]) {
        const rel = file.target.startsWith(PREFIX) ? file.target.slice(PREFIX.length) : file.target;
        const display = relative(root, resolveInside(baseDir, rel));
        if (existingRegularFile(baseDir, rel) && !opts.overwrite) {
          skipped.push(display);
          continue;
        }
        planned.push({ item, source, rel, display, content: file.content });
      }
    }
    if (!opts.dryRun) {
      for (const file of planned) writeInside(baseDir, file.rel, file.content);
    }
  } catch (error) {
    fail(error);
    return;
  }

  for (const file of planned) console.log(`${opts.dryRun ? "would write" : "wrote"}  ${file.display}${file.source === "pro" ? "  (pro)" : ""}`);
  for (const file of skipped) console.log(`skipped ${file} (exists; use --overwrite)`);

  const requirements = requirementLines([...resolved.values()].map((r) => r.item));
  if (requirements.length) {
    console.log("\nProject requirements (not applied automatically):");
    for (const line of requirements) console.log(`  - ${line}`);
  }
  if (planned.length && !opts.dryRun) {
    const files = `${planned.length} file${planned.length === 1 ? "" : "s"} in ./${config.directory}/`;
    console.log(detectXcodeProject(root)
      ? `\nDone. ${files}. Build in Xcode 16+; synchronized folders pick them up automatically.`
      : `\nDone. ${files}. Drag that folder into your app in Xcode to use them.`);
  }
}

/** Info.plist keys, capabilities and packages a piece needs, in the lines `add` prints. */
export function requirementLines(items: Pick<RegistryItem, "name" | "requiredCapabilities" | "infoPlist" | "spmDependencies">[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    for (const capability of item.requiredCapabilities) lines.push(`${item.name}: enable capability ${capability}`);
    for (const [key, value] of Object.entries(item.infoPlist)) lines.push(`${item.name}: add Info.plist ${key} = "${value}"`);
    for (const dependency of item.spmDependencies) lines.push(`${item.name}: add Swift package ${dependency.url} (from ${dependency.from})`);
  }
  return lines;
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
    const dirs = agents.map((agent) => skillsDir(root, agent, Boolean(opts.global)));
    const pieces = new Set<string>();
    for (const id of ids) {
      const item = await fetchKitItem(registries.pro, id, licenseKey, policyOf(opts));
      const { written, skipped } = writeKit(item, dirs, root, opts);
      for (const file of written) console.log(`${opts.dryRun ? "would write" : "wrote"}  ${file}  (${item.kind})`);
      for (const file of skipped) console.log(`skipped ${file} (exists; use --overwrite)`);
      if (item.kind === "recipe") for (const use of item.uses) pieces.add(use);
    }
    console.log(`\nBuild Kit: ${ids.length} item${ids.length === 1 ? "" : "s"} for ${agents.join(", ")}. Restart your agent so it picks up new skills.`);
    if (pieces.size) console.log(`The recipe assembles library screens. Add them with:\n  npx swiftpieces add ${[...pieces].join(" ")}`);
    return true;
  } catch (error) {
    return fail(error);
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
