import assert from "node:assert/strict";
import { createRegistry, freeDefinitions, validateProject, type Project, type TemplateDefinition, newId } from "../src/index.js";

export const registry = createRegistry(freeDefinitions);

export function projectFrom(template: TemplateDefinition): Project {
  const raw = template.create(() => newId());
  return validateProject({ ...raw, id: "p1" }, registry).value;
}

/**
 * Swift-shaped structural checks we can run without a Swift toolchain: delimiters balance outside
 * string literals, no stray tag characters, four-space indentation, no trailing whitespace.
 */
export function assertWellFormedSwift(code: string, label = "code") {
  assert.ok(!code.includes("\u0000"), `${label}: contains a range tag`);
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (const [i, line] of code.split("\n").entries()) {
    assert.equal(line, line.replace(/\s+$/, ""), `${label}:${i + 1} trailing whitespace`);
    const lead = line.match(/^ */)![0].length;
    assert.equal(lead % 4, 0, `${label}:${i + 1} indentation is not a multiple of 4: ${JSON.stringify(line)}`);
    let inString = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (inString) {
        if (ch === "\\") j++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === "/" && line[j + 1] === "/") break;
      if (ch === '"') inString = true;
      else if ("([{".includes(ch)) stack.push(ch);
      else if (")]}".includes(ch)) assert.equal(stack.pop(), pairs[ch], `${label}:${i + 1} unbalanced ${ch}`);
    }
    assert.ok(!inString, `${label}:${i + 1} unterminated string`);
  }
  assert.equal(stack.length, 0, `${label}: ${stack.length} unclosed delimiters`);
}
