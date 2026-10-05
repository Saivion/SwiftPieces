// Compiles the Playground's generated SwiftUI against the iOS simulator SDK, so "View SwiftUI" can
// never show code that does not build. Two passes:
//
//   definitions  every component on its own, at its defaults and in every variant and state
//   catalog      every free catalog entry and pattern, as the whole app Build would hand to Xcode
//   patterns     just the app library's pattern recreations (the free ones: Pro's aren't here)
//   projects     every project saved as JSON in a folder: the Pro apps, exported from the Pro repo
//                by its scripts/export-app-projects.ts, so their SwiftUI is checked the same way
//
// Each case is its own module: the generated files plus the SwiftPieces sources they use, straight
// from registry/swift. Usage: tsx scripts/typecheck-playground.ts [definitions|catalog|patterns|styles|all] [filter]
// (for styles, the filter is how many styled projects to compile; for projects, the folder).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildCatalogProject, createCatalog, createRegistry, defaultProps, fonts, freeDefinitions, generateProject, PRO_LIMITS, resolveTheme, shuffleTheme, styleSwiftSource, validateProject,
  type Project, type ScreenNode, type SwiftPieceDefinition,
} from "../packages/builder/src/index.js";
import { freeCatalogSource, patternsCatalogSource } from "../packages/builder/src/definitions/catalog/index.js";

const registry = createRegistry(freeDefinitions);
const mode = process.argv[2] ?? "all";
const filter = process.argv[3] ?? "";

const sdk = execFileSync("xcrun", ["--sdk", "iphonesimulator", "--show-sdk-path"]).toString().trim();
const version = execFileSync("xcrun", ["--sdk", "iphonesimulator", "--show-sdk-version"]).toString().trim();
// SP_IOS_TARGET=17.0 checks against the oldest iOS the generated apps run on (iOS 26 APIs stay gated).
const target = `arm64-apple-ios${process.env.SP_IOS_TARGET ?? version}-simulator`;

// Registry sources by Swift type name (the file name).
const sources = new Map<string, string>();
(function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".swift")) sources.set(f.replace(/\.swift$/, ""), p);
  }
})(join(import.meta.dirname, "..", "registry", "swift"));

function typecheck(label: string, project: Project): boolean {
  const gen = generateProject(project, registry);
  const dir = mkdtempSync(join(tmpdir(), "sp-typecheck-"));
  const files: string[] = [];
  for (const f of gen.files) {
    const p = join(dir, f.path);
    writeFileSync(p, f.content);
    files.push(p);
  }
  for (const piece of gen.pieces) {
    const src = sources.get(piece.name);
    if (!src) {
      console.log(`  FAIL  ${label}: no registry source for ${piece.name}`);
      return false;
    }
    const p = join(dir, `SP_${piece.name}.swift`);
    // A styled app's pieces take its fonts and corners, exactly as Build writes them.
    const source = readFileSync(src, "utf8");
    writeFileSync(p, project.theme ? styleSwiftSource(source, resolveTheme(project.theme)) : source);
    files.push(p);
  }
  try {
    execFileSync("xcrun", ["swiftc", "-typecheck", "-parse-as-library", "-target", target, "-sdk", sdk, "-swift-version", "6", ...files], { stdio: "pipe" });
    console.log(`  ok    ${label}`);
    return true;
  } catch (e) {
    const out = String((e as { stderr?: Buffer }).stderr ?? e);
    console.log(`  FAIL  ${label}\n${out.split("\n").filter((l) => /error:/.test(l)).slice(0, 12).map((l) => `        ${l.replace(dir + "/", "")}`).join("\n")}`);
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function single(def: SwiftPieceDefinition, props: Record<string, unknown>, children?: ScreenNode[]): Project {
  const node: ScreenNode = { id: "n1", component: def.id, props: { ...defaultProps(def), ...props } as ScreenNode["props"], ...(def.container ? { children: children ?? [] } : {}) };
  const raw = { v: 1, id: "p", name: "Check", shell: "single", updatedAt: 0, screens: [{ id: "s1", name: "CheckView", root: { id: "r", component: "screen", props: {}, children: [node] } }] };
  return validateProject(raw, registry).value;
}

let failed = 0;
let total = 0;
mkdirSync(tmpdir(), { recursive: true });
console.log(`Playground Swift type-check against iOS ${version} simulator SDK${process.env.SP_IOS_TARGET ? `, targeting iOS ${process.env.SP_IOS_TARGET}` : ""}`);

if (mode === "definitions" || mode === "all") {
  for (const def of registry.all) {
    if (def.hidden || (filter && !def.id.includes(filter))) continue;
    const kids: ScreenNode[] | undefined = def.container ? [{ id: "k1", component: "text", props: { text: "Inside" } }] : undefined;
    const cases: Array<[string, Record<string, unknown>]> = [["defaults", {}], ...(def.variants ?? []).map((v) => [`variant ${v.id}`, v.props] as [string, Record<string, unknown>]), ...(def.states ?? []).map((s) => [`state ${s.id}`, s.props] as [string, Record<string, unknown>])];
    for (const [name, props] of cases) {
      total++;
      if (!typecheck(`${def.id} (${name})`, single(def, props, kids))) failed++;
    }
  }
}

if (mode === "catalog" || mode === "patterns" || mode === "all") {
  const catalog = mode === "patterns" ? createCatalog(patternsCatalogSource) : createCatalog(freeCatalogSource, patternsCatalogSource);
  for (const entry of catalog.entries) {
    if (entry.href || entry.availability !== "free" || (filter && !`${entry.kind}/${entry.slug}`.includes(filter))) continue;
    total++;
    const build = await catalog.load(entry);
    if (!build || !typecheck(`${entry.kind}/${entry.slug}`, buildCatalogProject(entry, build, registry))) failed++;
  }
}

// styles: the app library's patterns under shuffled Styles, cycling every card style, backdrop,
// symbol setting and font, so everything Style writes into Theme.swift and the screens compiles.
if (mode === "styles" || mode === "all") {
  const catalog = createCatalog(patternsCatalogSource);
  const entries = catalog.entries.filter((e) => !e.href && e.availability === "free");
  const cards = ["flat", "raised", "outlined", "glass", "bold"] as const;
  const backdrops = ["none", "glow", "gradient", "grid", "paper"] as const;
  const symbols = ["outline", "fill", "hierarchical"] as const;
  const count = Number(filter) || 30;
  for (let i = 0; i < count; i++) {
    const entry = entries[i % entries.length];
    const build = await catalog.load(entry);
    if (!build) continue;
    const base = buildCatalogProject(entry, build, registry);
    const shuffled = shuffleTheme(1000 + i, undefined).theme;
    // A font family for the body (and a different heading) now and then, and every treatment in turn.
    const family = fonts.filter((f) => f.family && !f.headingOnly)[i % fonts.filter((f) => f.family && !f.headingOnly).length];
    const corners = (["square", "tight", "standard", "soft", "round"] as const)[i % 5];
    const textSize = (["default", "large", "xlarge", "xxlarge"] as const)[i % 4];
    // SP_CARDS=bold (or any card style) holds every project to that one card style.
    const card = (cards as readonly string[]).includes(process.env.SP_CARDS ?? "") ? (process.env.SP_CARDS as (typeof cards)[number]) : cards[i % 5];
    const theme = { ...shuffled, cards: card, backdrop: backdrops[(i + 2) % 5], symbols: symbols[i % 3], corners, textSize, ...(i % 2 ? { font: family.id } : {}) };
    total++;
    if (!typecheck(`styles ${entry.slug} · ${theme.name} (${theme.font}/${theme.headingFont ?? "same"}, ${theme.cards}, ${theme.backdrop}, ${theme.symbols}, ${theme.corners}, ${theme.textSize})`, { ...base, theme: theme as Project["theme"] })) failed++;
  }
}

// projects: built projects saved as JSON in a folder (the Pro apps), each validated at Pro's limits
// and compiled like a catalog entry. Nothing of them is kept here.
if (mode === "projects") {
  if (!filter) throw new Error("projects needs a folder: tsx scripts/typecheck-playground.ts projects <dir>");
  for (const f of readdirSync(filter).filter((x) => x.endsWith(".json")).sort()) {
    total++;
    const { value, issues } = validateProject(JSON.parse(readFileSync(join(filter, f), "utf8")), registry, PRO_LIMITS);
    if (issues.length) console.log(`  note  ${f}: ${issues.slice(0, 3).join("; ")}`);
    if (!typecheck(`projects/${f.replace(/\.json$/, "")}`, value)) failed++;
  }
}

console.log(`${total - failed}/${total} compiled`);
process.exit(failed ? 1 : 0);
