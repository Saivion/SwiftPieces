import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const CONFIG_FILE = "swiftpieces.json";
const PUBLIC_REGISTRIES = { free: "https://swiftpieces.com/r", pro: "https://pro.swiftpieces.com/r" };

/** SWIFTPIECES_REGISTRY / SWIFTPIECES_PRO_REGISTRY override everything, including swiftpieces.json (testing, self-hosting). */
export function withEnv(r: { free: string; pro: string }) {
  return { free: process.env.SWIFTPIECES_REGISTRY ?? r.free, pro: process.env.SWIFTPIECES_PRO_REGISTRY ?? r.pro };
}
/** What swiftpieces.json gets by default. */
export const CONFIG_REGISTRIES = PUBLIC_REGISTRIES;
export const DEFAULT_REGISTRIES = withEnv(PUBLIC_REGISTRIES);

export interface Config {
  $schema?: string;
  /** Path to the SwiftPieces folder, relative to the config file. */
  directory: string;
  minIOSVersion: string;
  registries: { free: string; pro: string };
}

export function findConfig(start = process.cwd()): { path: string; config: Config } | null {
  let dir = resolve(start);
  for (;;) {
    const p = join(dir, CONFIG_FILE);
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, "utf8")) as Partial<Config> & { registry?: string };
      // Back-compat with the single-registry shape.
      const registries = raw.registries ?? { free: raw.registry ?? PUBLIC_REGISTRIES.free, pro: PUBLIC_REGISTRIES.pro };
      return { path: p, config: { directory: raw.directory ?? "SwiftPieces", minIOSVersion: raw.minIOSVersion ?? "17.0", registries: withEnv(registries) } };
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function writeConfig(dir: string, config: Config): string {
  const p = join(dir, CONFIG_FILE);
  writeFileSync(p, JSON.stringify({ $schema: "https://swiftpieces.com/schema/config.json", ...config }, null, 2) + "\n");
  return p;
}

// ~/.swiftpieces/auth.json holds the Pro license key (Rev 3 §9). Env var wins.
const AUTH_DIR = join(homedir(), ".swiftpieces");
const AUTH_FILE = join(AUTH_DIR, "auth.json");

export function readLicenseKey(): string | undefined {
  if (process.env.SWIFTPIECES_LICENSE_KEY) return process.env.SWIFTPIECES_LICENSE_KEY;
  try {
    return (JSON.parse(readFileSync(AUTH_FILE, "utf8")) as { licenseKey?: string }).licenseKey;
  } catch {
    return undefined;
  }
}

export function writeLicenseKey(key: string | null) {
  mkdirSync(AUTH_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(AUTH_FILE, JSON.stringify(key ? { licenseKey: key } : {}, null, 2) + "\n", { mode: 0o600 });
  return AUTH_FILE;
}
