import assert from "node:assert/strict";
import { buildCatalogProject, createRegistry, freeDefinitions, type CatalogBuilder, type CatalogKind, type Project } from "../src/index.js";
import { builds as screens } from "../src/definitions/catalog/screens.js";
import { builds as flows } from "../src/definitions/catalog/flows.js";
import { builds as elements } from "../src/definitions/catalog/elements.js";
import { builds as interactions } from "../src/definitions/catalog/interactions.js";

export const registry = createRegistry(freeDefinitions);

const builds: Record<CatalogKind, Record<string, CatalogBuilder>> = { screens, flows, elements, interactions };

/** A catalog entry built the way the Playground builds it (deterministic ids, validated). */
export function entryProject(kind: CatalogKind, slug: string): Project {
  const build = builds[kind][slug];
  assert.ok(build, `no build for ${kind}/${slug}`);
  return buildCatalogProject({ kind, slug }, build, registry);
}

/**
 * Swift-shaped structural checks we can run without a Swift toolchain: delimiters balance outside
 * string literals, no stray tag characters, four-space indentation, no trailing whitespace.
 * (scripts/typecheck-playground.ts compiles the real thing with swiftc.)
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
        // `\(` opens interpolation: code (and string literals) until its matching `)`, then the
        // outer string again. Any other backslash escapes the next character.
        if (ch === "\\" && line[j + 1] === "(") {
          stack.push("\\(");
          inString = false;
          j++;
        } else if (ch === "\\") j++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === "/" && line[j + 1] === "/") break;
      if (ch === '"') inString = true;
      else if ("([{".includes(ch)) stack.push(ch);
      else if (ch === ")" && stack[stack.length - 1] === "\\(") {
        stack.pop();
        inString = true;
      } else if (")]}".includes(ch)) assert.equal(stack.pop(), pairs[ch], `${label}:${i + 1} unbalanced ${ch}`);
    }
    assert.ok(!inString, `${label}:${i + 1} unterminated string`);
  }
  assert.equal(stack.length, 0, `${label}: ${stack.length} unclosed delimiters`);
}
