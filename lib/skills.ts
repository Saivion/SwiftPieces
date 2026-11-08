// The free agent skills in skills/, compiled into registry/__registry__/skills.json by
// scripts/build-registry.ts. Imported only by the MCP route, so pages don't carry the text.
import skillsJson from "@/registry/__registry__/skills.json";

export type SkillReference = { id: string; title: string; body: string };
export type Skill = { name: string; title: string; description: string; version: string; body: string; references: SkillReference[] };

export const skills = skillsJson as Skill[];

export const getSkill = (name: string) => skills.find((s) => s.name === name);

export const skillUri = (skill: Skill) => `swiftpieces://skills/${skill.name}`;
export const referenceUri = (skill: Skill, ref: SkillReference) => `${skillUri(skill)}/references/${ref.id}`;

/**
 * SKILL.md as an agent receives it over MCP. Its links to references/<id>.md only resolve when the
 * folder is on disk, so a footer says how to read each reference through this server instead.
 */
export function skillText(skill: Skill, tool: string) {
  if (!skill.references.length) return skill.body;
  const rows = skill.references.map((r) => `- ${r.id}: ${r.title}. Call ${tool} with reference "${r.id}", or read ${referenceUri(skill, r)}.`);
  return `${skill.body}\n\n---\n\nThe references/ files this skill links to are served by the SwiftPieces MCP. When the skill says to load one:\n${rows.join("\n")}`;
}
