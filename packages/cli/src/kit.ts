import { homedir } from "node:os";
import { join, relative } from "node:path";
import { existsSync } from "node:fs";
import { RegistryError, request, sendsLicenseKey, type FetchPolicy, OFFICIAL_PRO_ORIGIN, assertRegistryUrl } from "./registry.js";
import { formatZodError, kitItemSchema, type KitItem } from "./schema.js";
import { existingRegularFile, resolveInside, writeInside } from "./safe-path.js";

// Build Kit items install as Agent Skills (a folder with SKILL.md) where the user's coding agent
// looks for them, not into the SwiftPieces folder. They come from the Pro registry at /r/kit/<id>.json.

export type Agent = "claude" | "codex" | "cursor" | "xcode";
export const AGENTS: Agent[] = ["claude", "codex", "cursor", "xcode"];

/** Kit ids: the free setup skill, or a prefixed style, brief, recipe or tool. */
export function isKitId(name: string): boolean {
  return name === "swift-pieces" || /^(style|brief|recipe|tool)-[a-z0-9-]+$/.test(name);
}

const PROJECT_DIRS: Record<Exclude<Agent, "xcode">, string> = { claude: ".claude/skills", codex: ".agents/skills", cursor: ".cursor/skills" };
const GLOBAL_DIRS: Record<Agent, string> = {
  claude: join(homedir(), ".claude/skills"),
  codex: join(homedir(), ".agents/skills"),
  cursor: join(homedir(), ".cursor/skills"),
  // Claude in Xcode reads only its own folder, so it is always global.
  xcode: join(homedir(), "Library/Developer/Xcode/CodingAssistant/ClaudeAgentConfig/skills"),
};

/** Agents to install for: the flag, else the ones this project already uses, else Claude Code. */
export function resolveAgents(root: string, flag?: string): Agent[] {
  if (flag) {
    const picked = flag.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
    const bad = picked.filter((a) => !AGENTS.includes(a as Agent));
    if (bad.length) throw new RegistryError(`Unknown agent "${bad.join(", ")}". Use one of: ${AGENTS.join(", ")}.`);
    return picked as Agent[];
  }
  const detected = (["claude", "cursor"] as const).filter((a) => existsSync(join(root, a === "claude" ? ".claude" : ".cursor")));
  if (existsSync(join(root, ".agents")) || existsSync(join(root, "AGENTS.md"))) (detected as Agent[]).push("codex");
  return detected.length ? (detected as Agent[]) : ["claude"];
}

export function skillsDir(root: string, agent: Agent, global: boolean): string {
  return agent === "xcode" || global ? GLOBAL_DIRS[agent] : join(root, PROJECT_DIRS[agent]);
}

export type { KitItem };

function kitUrl(proRegistry: string, suffix: string, policy: FetchPolicy): URL {
  const root = assertRegistryUrl(proRegistry, policy);
  const url = new URL(suffix.replace(/^\//, ""), `${root.toString().replace(/\/$/, "")}/`);
  return assertRegistryUrl(url.toString(), policy);
}

export async function fetchKitItem(proRegistry: string, id: string, licenseKey?: string, policy: FetchPolicy = {}): Promise<KitItem> {
  const url = kitUrl(proRegistry, `kit/${encodeURIComponent(id)}.json`, policy);
  const headers: Record<string, string> = { "user-agent": "swiftpieces-cli", accept: "application/json" };
  if (licenseKey && sendsLicenseKey(url, policy)) headers["x-license-key"] = licenseKey;
  const res = await request(url.toString(), { headers });
  if (res.status === 404) throw new RegistryError(`No Build Kit item "${id}". Run \`npx swiftpieces list --kit\`.`, 404);
  if (res.status === 401) {
    const kept = Boolean(licenseKey) && !sendsLicenseKey(url, policy);
    throw new RegistryError(
      kept
        ? `"${id}" is part of the SwiftPieces Pro Build Kit, and the license key was not sent to ${url.origin}. The key is only sent to ${OFFICIAL_PRO_ORIGIN}. Pass --trust-registry if you trust this registry.`
        : `"${id}" is part of the SwiftPieces Pro Build Kit. Run \`npx swiftpieces login <key>\` with your license key, or get Pro at https://pro.swiftpieces.com/pro`,
      401,
    );
  }
  if (res.status === 403) throw new RegistryError(`"${id}" is part of SwiftPieces Pro, and this license's account doesn't own it. Get it at https://pro.swiftpieces.com/pro`, 403);
  if (!res.ok) throw new RegistryError(`Build Kit returned ${res.status} for "${id}"`, res.status);
  const parsed = kitItemSchema.safeParse(await res.json());
  if (!parsed.success) throw new RegistryError(`"${id}" failed validation and was not written. ${formatZodError(parsed.error)}`);
  return parsed.data;
}

export async function fetchKitIndex(proRegistry: string, policy: FetchPolicy = {}): Promise<Omit<KitItem, "files">[]> {
  const url = kitUrl(proRegistry, "kit/index.json", policy);
  const res = await request(url.toString(), { headers: { "user-agent": "swiftpieces-cli", accept: "application/json" } });
  if (!res.ok) throw new RegistryError(`Build Kit index returned ${res.status}`, res.status);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new RegistryError("Build Kit index was not a list.");
  return data as Omit<KitItem, "files">[];
}

/** Writes an item's files under each agent's skills folder. Paths that leave that folder are refused. */
export function writeKit(item: KitItem, dirs: string[], root: string, opts: { overwrite?: boolean; dryRun?: boolean }) {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const dir of dirs) {
    for (const file of item.files) {
      resolveInside(dir, file.path);
      const displayPath = join(dir, file.path);
      const display = displayPath.startsWith(root) ? relative(root, displayPath) : displayPath.replace(homedir(), "~");
      if (existingRegularFile(dir, file.path) && !opts.overwrite) { skipped.push(display); continue; }
      if (!opts.dryRun) writeInside(dir, file.path, file.content);
      written.push(display);
    }
  }
  return { written, skipped };
}
