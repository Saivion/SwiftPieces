/**
 * Single source of truth: registry/swift/<category>/<Name>.swift
 *
 * Each .swift file starts with a `// swiftpieces:` header block (YAML inside
 * line comments). An optional sidecar <Name>.mdx next to it holds prose.
 * This script emits, mirroring React Bits' unified build (spec §4):
 *   registry/__registry__/index.json   public index (no file contents)
 *   registry/__registry__/items.json   full items, imported only by Route Handlers
 *   content/docs/<category>/<slug>.mdx generated docs pages
 *   public/llms.txt                    AI discoverability
 *   public/schema/registry-item.json   JSON schema for the registry protocol
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  categorySchema,
  registryItemSchema,
  type Category,
  type RegistryIndexEntry,
  type RegistryItem,
} from "../lib/registry-schema";
import { categories } from "../lib/categories";
import { proCatalog, proCountsLabel } from "../lib/pro-catalog";

const ROOT = join(import.meta.dirname, "..");
const SWIFT_DIR = join(ROOT, "registry/swift");
const OUT_DIR = join(ROOT, "registry/__registry__");
const DOCS_DIR = join(ROOT, "content/docs");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://swiftpieces.com";
const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL ?? "https://media.swiftpieces.com";
const PRO_URL = process.env.NEXT_PUBLIC_PRO_URL ?? "https://pro.swiftpieces.com";

const headerSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: categorySchema,
  minIOSVersion: z.string(),
  version: z.string().default("1.0.0"),
  tags: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  spmDependencies: z.array(z.object({ url: z.string(), from: z.string(), product: z.string().optional() })).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  infoPlist: z.record(z.string(), z.string()).default({}),
  shaders: z.array(z.string()).default([]),
  assets: z.array(z.string()).default([]),
  /** The Swift Pieces Pro screen this piece grows into (a Pro registry id), shown as the upgrade path on its page. */
  pro: z.string().regex(/^[a-z0-9-]+$/).optional(),
});

// Docs live under the single "components" root section: /docs/components/<category slug>/<piece slug>.
export const docsPath = (category: Category, slug: string) => `/docs/components/${categories[category].slug}/${slug}`;

type PreviewManifest = Record<string, { webm?: string; mp4?: string; poster?: string }>;

function readPreviewManifest(): PreviewManifest {
  const p = join(ROOT, "previews/manifest.json");
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as PreviewManifest) : {};
}


/** Absolute URLs pass through; "/previews/x" is site-relative; anything else is an R2 key under MEDIA_URL. */
function mediaUrl(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("/")) return `${SITE_URL}${value}`;
  return `${MEDIA_URL}/${value}`;
}

function parseHeader(source: string, file: string) {
  const lines = source.split("\n");
  if (!lines[0]?.startsWith("// swiftpieces:")) {
    throw new Error(`${file}: first line must be "// swiftpieces:"`);
  }
  const yamlLines: string[] = [];
  let end = 1;
  for (; end < lines.length; end++) {
    const line = lines[end];
    if (!line.startsWith("//")) break;
    yamlLines.push(line.replace(/^\/\/ ?/, ""));
  }
  const parsed = headerSchema.safeParse(parseYaml(yamlLines.join("\n")));
  if (!parsed.success) {
    throw new Error(`${file}: invalid header\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  return { header: parsed.data, body: lines.slice(end).join("\n").replace(/^\n+/, "") };
}

export function toSlug(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function build() {
  const previews = readPreviewManifest();
  const items: RegistryItem[] = [];

  for (const category of readdirSync(SWIFT_DIR).sort()) {
    const catDir = join(SWIFT_DIR, category);
    const parsedCat = categorySchema.safeParse(category);
    if (!parsedCat.success) throw new Error(`Unknown category folder: ${category}`);

    for (const file of readdirSync(catDir).filter((f) => f.endsWith(".swift")).sort()) {
      const name = basename(file, ".swift");
      const abs = join(catDir, file);
      const raw = readFileSync(abs, "utf8");
      const { header, body } = parseHeader(raw, relative(ROOT, abs));
      if (header.category !== parsedCat.data) {
        throw new Error(`${file}: header category "${header.category}" does not match folder "${category}"`);
      }
      const slug = toSlug(name);
      const folder = categories[header.category].folder;
      const preview = previews[slug] ?? {};

      const shaders = header.shaders.map((s) => {
        const p = join(catDir, s);
        if (!existsSync(p)) throw new Error(`${file}: shader ${s} not found`);
        return {
          path: relative(ROOT, p),
          type: "registry:shader" as const,
          target: `SwiftPieces/${folder}/${s}`,
          content: readFileSync(p, "utf8"),
        };
      });
      const assets = header.assets.map((a) => {
        const p = join(catDir, a);
        if (!existsSync(p)) throw new Error(`${file}: asset ${a} not found`);
        return {
          path: relative(ROOT, p),
          type: "registry:asset" as const,
          target: `SwiftPieces/${folder}/${a}`,
          content: readFileSync(p, "utf8"),
        };
      });

      const item = registryItemSchema.parse({
        name,
        slug,
        type: "registry:component",
        title: header.title,
        description: header.description,
        category: header.category,
        version: header.version,
        minIOSVersion: header.minIOSVersion,
        tags: header.tags,
        registryDependencies: header.registryDependencies,
        spmDependencies: header.spmDependencies,
        requiredCapabilities: header.requiredCapabilities,
        infoPlist: header.infoPlist,
        shaders,
        assets,
        files: [
          {
            path: relative(ROOT, abs),
            type: "registry:component",
            target: `SwiftPieces/${folder}/${file}`,
            content: body,
          },
        ],
        preview: {
          video: mediaUrl(preview.webm),
          videoMp4: mediaUrl(preview.mp4),
          poster: mediaUrl(preview.poster),
        },
        docs: `${SITE_URL}${docsPath(header.category, slug)}`,
        pro: header.pro,
        liquidGlass: /glassEffect|GlassEffectContainer|buttonStyle\(\.glass/.test(body),
        metal: shaders.length > 0 || /ShaderLibrary/.test(body),
      });
      items.push(item);
    }
  }

  const names = new Set(items.map((i) => i.name));
  for (const item of items) {
    for (const dep of item.registryDependencies) {
      if (!names.has(dep)) throw new Error(`${item.name}: registryDependency "${dep}" does not exist`);
    }
  }

  // Every piece needs a recording scene, or previews silently go missing.
  const catalog = readFileSync(join(ROOT, "previews/SwiftPiecesPreviews/PreviewCatalog.swift"), "utf8");
  const missingScenes = items.filter((i) => !catalog.includes(`"${i.name}"`)).map((i) => i.name);
  if (missingScenes.length) throw new Error(`PreviewCatalog.swift has no scene for: ${missingScenes.join(", ")}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const index: RegistryIndexEntry[] = items.map((i) => ({
    ...i,
    files: i.files.map(({ content: _c, ...f }) => f),
    shaders: i.shaders.map(({ content: _c, ...f }) => f),
    assets: i.assets.map(({ content: _c, ...f }) => f),
  }));
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));
  writeFileSync(join(OUT_DIR, "items.json"), JSON.stringify(Object.fromEntries(items.map((i) => [i.name, i])), null, 2));

  writeDocs(items);
  writeLlms(items);
  writeSchema();

  console.log(`registry: ${items.length} free pieces, ${items.filter((i) => i.liquidGlass).length} Liquid Glass, ${items.filter((i) => i.metal).length} Metal`);
}


/** Pulls the `///` doc block above the first `public struct|extension` and the `#Preview` body. */
function extractDocs(body: string) {
  const lines = body.split("\n");
  const docLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\/\/\//.test(line)) {
      docLines.push(line.replace(/^\s*\/\/\/ ?/, ""));
    } else if (docLines.length && /^\s*(public|@available|@MainActor|@Observable)/.test(line)) {
      break;
    } else if (docLines.length) {
      docLines.length = 0;
    }
  }
  let summary = "";
  const params: { name: string; text: string }[] = [];
  let inParams = false;
  for (const l of docLines) {
    if (/^- Parameters:/.test(l)) { inParams = true; continue; }
    const m = inParams ? l.match(/^\s*-\s*([A-Za-z0-9_]+):\s*(.*)$/) : null;
    if (m) params.push({ name: m[1], text: m[2] });
    else if (!inParams && l.trim()) summary += (summary ? " " : "") + l.trim();
  }
  const previewStart = body.indexOf("#Preview");
  let preview = "";
  if (previewStart >= 0) {
    const open = body.indexOf("{", previewStart);
    let depth = 0;
    for (let i = open; i < body.length; i++) {
      if (body[i] === "{") depth++;
      if (body[i] === "}") { depth--; if (depth === 0) { preview = body.slice(open + 1, i); break; } }
    }
    // Dedent by the smallest indent.
    const pl = preview.replace(/^\n+|\s+$/g, "").split("\n");
    const indent = Math.min(...pl.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length));
    preview = pl.map((l) => l.slice(indent)).join("\n");
  }
  return { summary, params, preview };
}

function writeDocs(items: RegistryItem[]) {
  // Everything under content/docs/components is generated, so the section is rebuilt from scratch; stale legacy category folders at the docs root go too.
  for (const cat of Object.keys(categories)) rmSync(join(DOCS_DIR, cat), { recursive: true, force: true });
  const root = join(DOCS_DIR, "components");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  const cats = (Object.keys(categories) as Category[]).filter((c) => items.some((i) => i.category === c));
  writeFileSync(join(root, "index.mdx"), `---\ntitle: "All components"\ndescription: "Every free piece. Filter by category, open a piece for its parameters, source and install commands."\nindex: true\n---\n\n{/* GENERATED FILE. Edit scripts/build-registry.ts. */}\n`);
  writeFileSync(join(root, "meta.json"), JSON.stringify({
    title: "Components",
    root: true,
    pages: ["index", `---Categories · ${cats.length}---`, ...cats.map((c) => categories[c].slug)],
  }, null, 2));

  for (const cat of cats) {
    const dir = join(root, categories[cat].slug);
    mkdirSync(dir, { recursive: true });
    const members = items.filter((i) => i.category === cat);
    writeFileSync(join(dir, "meta.json"), JSON.stringify({ title: categories[cat].title, description: categories[cat].description, defaultOpen: false, pages: members.map((i) => i.slug) }, null, 2));
    for (const item of members) {
      const sidecar = join(SWIFT_DIR, item.category, `${item.name}.mdx`);
      const prose = existsSync(sidecar) ? readFileSync(sidecar, "utf8").trim() : "";
      const frontmatter = { title: item.title, description: item.description, piece: item.name, category: item.category, minIOSVersion: item.minIOSVersion, version: item.version, tags: item.tags, registryDependencies: item.registryDependencies };
      const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
      const docs = extractDocs(item.files[0].content ?? "");
      const paramsTable = docs.params.length ? `## Parameters\n\n| Parameter | Description |\n| --- | --- |\n${docs.params.map((p) => `| \`${p.name}\` | ${p.text.replace(/\|/g, "\\|")} |`).join("\n")}\n` : "";
      const usage = docs.preview ? `## Usage\n\n\`\`\`swift\n${docs.preview}\n\`\`\`\n` : "";
      const sources = [item.files[0], ...item.shaders];
      const sourceTabs = sources.map((f) => { const lang = f.target.endsWith(".metal") ? "cpp" : "swift"; return `<Tab value="${basename(f.target)}">\n\n\`\`\`${lang} title="${basename(f.target)}"\n${f.content?.trimEnd()}\n\`\`\`\n\n</Tab>`; }).join("\n");
      const tabNames = sources.map((f) => `"${basename(f.target)}"`).join(", ");
      writeFileSync(join(dir, `${item.slug}.mdx`), `---\n${fm}\n---\n\n{/* GENERATED FILE. Edit registry/swift/${item.category}/${item.name}.swift or ${item.name}.mdx instead. */}\n\n${docs.summary}\n\n${prose}\n\n${usage}\n${paramsTable}\n## Source\n\n<Tabs items={[${tabNames}]}>\n${sourceTabs}\n</Tabs>\n`);
    }
  }
  writeFileSync(join(DOCS_DIR, "meta.json"), JSON.stringify({ title: "Swift Pieces", pages: ["introduction", "installation", "cli", "mcp", "liquid-glass", "components"] }, null, 2));
}

function writeLlms(items: RegistryItem[]) {
  const byCat = new Map<string, RegistryItem[]>();
  for (const i of items) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
  const lines = [
    "# Swift Pieces",
    "",
    "> Animated SwiftUI components, Liquid Glass (iOS 26) effects, and Metal shaders you copy into your app. Free pieces are MIT + Commons Clause. Install by copy-paste, `npx swiftpieces add <Name>`, or the Swift Pieces MCP server.",
    "",
    "Rules for Liquid Glass: gate with `#available(iOS 26, *)` and a Material fallback; wrap multiple glass views in one `GlassEffectContainer`; apply `.glassEffect` after layout modifiers; respect `accessibilityReduceTransparency`; never use invented modifiers such as `.liquidGlassUltra`.",
    "",
    "## Docs",
    "",
    `- [Introduction](${SITE_URL}/docs/introduction)`,
    `- [Installation](${SITE_URL}/docs/installation)`,
    `- [CLI](${SITE_URL}/docs/cli)`,
    `- [Registry index (JSON)](${SITE_URL}/r/index.json)`,
    `- [Free MCP endpoint](${SITE_URL}/api/mcp): search_pieces, get_piece, install_piece, list_categories, get_liquid_glass_guide`,
    "",
    "## Swift Pieces Pro",
    "",
    `The complete library: ${proCountsLabel} (production-ready SwiftUI screens, complete Xcode projects, and agent skills that build the rest in the same design) at ${PRO_URL}/library. Plan and pricing: ${PRO_URL}/pro. Pro MCP endpoint: ${PRO_URL}/api/mcp (license key required): search_library, get_item, list_kit, get_kit_item, apply_design_skill, apply_recipe.`,
    "",
  ];
  for (const [cat, list] of byCat) {
    lines.push(`## ${cat}`, "");
    for (const i of list) {
      lines.push(
        `- [${i.title}](${i.docs}): ${i.description} (iOS ${i.minIOSVersion}+${i.liquidGlass ? ", Liquid Glass" : ""}${i.metal ? ", Metal" : ""}). Registry: ${SITE_URL}/r/${i.name}.json`,
      );
    }
    lines.push("");
  }
  mkdirSync(join(ROOT, "public"), { recursive: true });
  writeFileSync(join(ROOT, "public/llms.txt"), lines.join("\n"));
}

function writeSchema() {
  mkdirSync(join(ROOT, "public/schema"), { recursive: true });
  const schema = z.toJSONSchema(registryItemSchema, { target: "draft-7" });
  writeFileSync(
    join(ROOT, "public/schema/registry-item.json"),
    JSON.stringify({ $id: `${SITE_URL}/schema/registry-item.json`, title: "Swift Pieces registry item", ...schema }, null, 2),
  );
}

build();
