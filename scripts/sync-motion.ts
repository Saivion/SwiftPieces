/**
 * Copies the shared design language into every piece that uses it: the motion language and the liquid glass
 * language, each from its own canonical source, each into its own block at the end of the piece.
 *
 *   npm run motion:sync     rewrite each piece's "Piece motion" and "Piece liquid" blocks from the sources
 *   npm run motion:check    fail if any piece's blocks differ from what sync would write
 *   npm run motion:sync -- registry/swift/controls/ElasticButton.swift    only the pieces named
 *
 * The canonical sources are registry/foundation/PieceMotion.swift and registry/foundation/PieceLiquid.swift.
 * Each is split into sections (`swiftpieces-motion-section` and `swiftpieces-liquid-section`):
 *
 *   // swiftpieces-motion-section: press
 *   // requires: core
 *   // provides: piecePress, PieceMotion.pressScale
 *
 * A piece gets a section when its own code names something the section provides (`PieceMotion` and
 * `piecePress` match as whole words, `.follow(` matches a call on a PieceMotion value), plus every section
 * that one requires. The block is
 * appended to the end of the piece, after its previews, so each .swift file still stands alone: install one
 * piece and it builds. Everything in the block is `private`, so two pieces in one app never collide.
 * registry:build runs the check, so a stale copy can't reach the registry or the docs.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const SWIFT_DIR = join(ROOT, "registry/swift");

/** The shared languages, in the order their blocks follow a piece's own code. */
const SOURCES = [
  {
    kind: "motion",
    file: join(ROOT, "registry/foundation/PieceMotion.swift"),
    begin: "// MARK: - Piece motion",
    end: "// swiftpieces-motion: end",
    about: [
      "// The SwiftPieces motion language: shared spring tokens and gesture physics, with the same values in every",
      "// piece. Each piece carries a copy of only the parts it uses, so this file stands alone. Generated from",
      "// registry/foundation/PieceMotion.swift in the SwiftPieces repo; edit it there, not here.",
    ],
  },
  {
    kind: "liquid",
    file: join(ROOT, "registry/foundation/PieceLiquid.swift"),
    begin: "// MARK: - Piece liquid",
    end: "// swiftpieces-liquid: end",
    about: [
      "// The SwiftPieces liquid glass language: glass shapes that merge through a neck, bubbles that bud out of",
      "// and melt back into each other, and the frosted fallback before iOS 26. Each piece carries a copy of only",
      "// the parts it uses, so this file stands alone. Generated from registry/foundation/PieceLiquid.swift in the",
      "// SwiftPieces repo; edit it there, not here. The rules are in LIQUID_GLASS.md.",
    ],
  },
] as const;

type Kind = (typeof SOURCES)[number]["kind"];
type Section = { kind: Kind; name: string; requires: string[]; provides: string[]; body: string };

function parseSource(): { versions: Record<Kind, string>; sections: Section[] } {
  const versions = {} as Record<Kind, string>;
  const sections: Section[] = [];
  for (const source of SOURCES) {
    const parsed = parseOne(source.kind, source.file);
    versions[source.kind] = parsed.version;
    sections.push(...parsed.sections);
  }
  const names = new Set<string>();
  for (const s of sections) {
    if (names.has(s.name)) throw new Error(`section "${s.name}" is defined twice across the foundation sources`);
    names.add(s.name);
  }
  for (const s of sections) {
    for (const r of s.requires) if (!names.has(r)) throw new Error(`${s.kind} section "${s.name}" requires unknown section "${r}"`);
  }
  return { versions, sections };
}

function parseOne(kind: Kind, file: string): { version: string; sections: Section[] } {
  const lines = readFileSync(file, "utf8").split("\n");
  const version = lines.map((l) => l.match(/^\/\/ version: (\S+)/)?.[1]).find(Boolean);
  if (!version) throw new Error(`${relative(ROOT, file)}: missing "// version: x.y.z" line`);
  const marker = new RegExp(`^\\/\\/ swiftpieces-${kind}-section: (\\w+)\\s*$`);
  const sections: Section[] = [];
  let current: Section | null = null;
  let body: string[] = [];
  const close = () => {
    if (current) sections.push({ ...current, body: body.join("\n").replace(/^\n+|\s+$/g, "") });
  };
  for (const line of lines) {
    const start = line.match(marker);
    if (start) {
      close();
      current = { kind, name: start[1], requires: [], provides: [], body: "" };
      body = [];
      continue;
    }
    if (!current) continue; // the file header (imports, notes) is not copied
    const meta = line.match(/^\/\/ (requires|provides): (.*)$/);
    if (meta && body.every((l) => !l.trim())) {
      current[meta[1] as "requires" | "provides"] = meta[2].split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    body.push(line);
  }
  close();
  return { version, sections };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A piece's own code: everything outside its vendored blocks. */
function stripBlock(source: string): string {
  let code = source;
  for (const { begin: BEGIN, end: END } of SOURCES) {
    const begin = code.indexOf(`\n${BEGIN}\n`);
    if (begin < 0) continue;
    const end = code.indexOf(END, begin);
    if (end < 0) throw new Error(`found "${BEGIN}" without "${END}"`);
    code = (code.slice(0, begin) + code.slice(end + END.length)).replace(/\s+$/, "\n");
  }
  return code;
}

function usedSections(code: string, sections: Section[]): Section[] {
  const byName = new Map(sections.map((s) => [s.name, s]));
  const used = new Set<string>();
  const visit = (name: string) => {
    if (used.has(name)) return;
    used.add(name);
    for (const r of byName.get(name)!.requires) visit(r);
  };
  for (const s of sections) {
    const hit = s.provides.some((token) => {
      // Whole-word edges only where the token itself starts or ends with a word character, so `.follow(` matches `motion.follow(rank: 1)`.
      const before = /^\w/.test(token) ? "(?<![A-Za-z0-9_])" : "";
      const after = /\w$/.test(token) ? "(?![A-Za-z0-9_])" : "";
      return new RegExp(`${before}${escape(token)}${after}`).test(code);
    });
    if (hit) visit(s.name);
  }
  return sections.filter((s) => used.has(s.name)); // canonical order
}

function render(source: (typeof SOURCES)[number], version: string, sections: Section[]): string {
  return [
    source.begin,
    "//",
    ...source.about,
    `// swiftpieces-${source.kind}: ${version} (${sections.map((s) => s.name).join(", ")})`,
    "",
    sections.map((s) => s.body).join("\n\n"),
    "",
    source.end,
    "",
  ].join("\n");
}

/** What a piece file should contain: its own code, then a block per language for the sections it uses (if any). */
function expected(source: string, versions: Record<Kind, string>, sections: Section[]): string {
  const code = stripBlock(source);
  const used = usedSections(code, sections);
  if (!used.length) return code;
  const blocks = SOURCES.map((src) => ({ src, mine: used.filter((s) => s.kind === src.kind) }))
    .filter((b) => b.mine.length)
    .map((b) => render(b.src, versions[b.src.kind], b.mine));
  return `${code.replace(/\s+$/, "")}\n\n${blocks.join("\n")}`;
}

function pieceFiles(): string[] {
  return readdirSync(SWIFT_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(SWIFT_DIR, d.name)).filter((f) => f.endsWith(".swift")).map((f) => join(SWIFT_DIR, d.name, f)))
    .sort();
}

/** Pieces whose vendored motion or liquid block is missing, stale or no longer needed. Empty when everything is in sync. */
export function motionDrift(): string[] {
  const { versions, sections } = parseSource();
  return pieceFiles().filter((file) => {
    const source = readFileSync(file, "utf8");
    return expected(source, versions, sections) !== source;
  }).map((f) => relative(ROOT, f));
}

/** Which motion and liquid sections each piece carries, for reports. */
export function motionUsage(): Record<string, string[]> {
  const { sections } = parseSource();
  return Object.fromEntries(pieceFiles().map((file) => [relative(SWIFT_DIR, file), usedSections(stripBlock(readFileSync(file, "utf8")), sections).map((s) => s.name)]));
}

function main() {
  const check = process.argv.includes("--check");
  const only = process.argv.slice(2).filter((a) => a.endsWith(".swift")).map((a) => resolve(a));
  const { versions, sections } = parseSource();
  const changed: string[] = [];
  for (const file of only.length ? only : pieceFiles()) {
    const source = readFileSync(file, "utf8");
    const next = expected(source, versions, sections);
    if (next === source) continue;
    changed.push(relative(ROOT, file));
    if (!check) writeFileSync(file, next);
  }
  if (check) {
    if (changed.length) {
      console.error(`Piece motion or liquid blocks are out of date in:\n${changed.map((f) => `  ${f}`).join("\n")}\nRun \`npm run motion:sync\`.`);
      process.exit(1);
    }
    console.log(`motion: every piece matches PieceMotion.swift ${versions.motion} and PieceLiquid.swift ${versions.liquid}`);
    return;
  }
  if (process.argv.includes("--report")) {
    for (const [file, used] of Object.entries(motionUsage())) console.log(`${used.length ? used.join(", ") : "-"}\t${file}`);
  }
  console.log(changed.length ? `motion: updated ${changed.length} piece${changed.length === 1 ? "" : "s"}\n${changed.map((f) => `  ${f}`).join("\n")}` : "motion: nothing to update");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
