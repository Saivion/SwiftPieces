import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { RegistryError, request } from "./registry.js";

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

type KitFile = { path: string; content?: string };
export type KitItem = { id: string; kind: string; title: string; skillName: string; uses: string[]; availability: "free" | "pro"; files?: KitFile[] };

export async function fetchKitItem(proRegistry: string, id: string, licenseKey?: string): Promise<KitItem> {
  const headers: Record<string, string> = { "user-agent": "swiftpieces-cli", accept: "application/json" };
  if (licenseKey) headers["x-license-key"] = licenseKey;
  const res = await request(`${proRegistry.replace(/\/$/, "")}/kit/${encodeURIComponent(id)}.json`, { headers });
  if (res.status === 404) throw new RegistryError(`No Build Kit item "${id}". Run \`npx swiftpieces list --kit\`.`, 404);
  if (res.status === 401) throw new RegistryError(`"${id}" is part of the Swift Pieces Pro Build Kit. Run \`npx swiftpieces login <key>\` with your license key, or get Pro at https://pro.swiftpieces.com/pro`, 401);
  if (res.status === 403) throw new RegistryError(`"${id}" is part of Swift Pieces Pro, and this license's account doesn't own it. Get it at https://pro.swiftpieces.com/pro`, 403);
  if (!res.ok) throw new RegistryError(`Build Kit returned ${res.status} for "${id}"`, res.status);
  const item = (await res.json()) as KitItem;
  if (!item.files?.some((f) => f.content !== undefined)) throw new RegistryError(`The Build Kit did not return "${id}". Check \`npx swiftpieces whoami\`.`, 403);
  return item;
}

export async function fetchKitIndex(proRegistry: string): Promise<Omit<KitItem, "files">[]> {
  const res = await request(`${proRegistry.replace(/\/$/, "")}/kit/index.json`, { headers: { "user-agent": "swiftpieces-cli", accept: "application/json" } });
  if (!res.ok) throw new RegistryError(`Build Kit index returned ${res.status}`, res.status);
  return (await res.json()) as Omit<KitItem, "files">[];
}

/** Writes an item's files under each agent's skills folder. Returns written and skipped paths for display. */
export function writeKit(item: KitItem, dirs: string[], root: string, opts: { overwrite?: boolean; dryRun?: boolean }) {
  const written: string[] = [];
  const skipped: string[] = [];
  for (const dir of dirs) {
    for (const file of item.files ?? []) {
      if (file.content === undefined) continue;
      const dest = join(dir, file.path);
      const display = dest.startsWith(root) ? relative(root, dest) : dest.replace(homedir(), "~");
      if (existsSync(dest) && !opts.overwrite) { skipped.push(display); continue; }
      if (!opts.dryRun) {
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, file.content);
      }
      written.push(display);
    }
  }
  return { written, skipped };
}
