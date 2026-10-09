/**
 * Single source of truth: registry/swift/<category>/<Name>.swift
 *
 * Each .swift file starts with a `// swiftpieces:` header block (YAML inside
 * line comments). An optional sidecar <Name>.mdx next to it holds prose.
 * This script emits, mirroring React Bits' unified build (spec §4):
 *   registry/__registry__/index.json   public index (no file contents)
 *   registry/__registry__/items.json   full items, imported only by Route Handlers
 *   content/docs/<category>/<slug>.mdx generated docs pages
 *   registry/__registry__/docs.json    every docs page's URL, title and search text (search, sitemap)
 *   public/llms.txt                    AI discoverability
 *   public/schema/registry-item.json   JSON schema for the registry protocol
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { structure } from "fumadocs-core/mdx-plugins";
import { findPath, type Root } from "fumadocs-core/page-tree";
import { loader, type VirtualFile } from "fumadocs-core/source";
import remarkMdx from "remark-mdx";
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
import { exploreProPages, proCatalog, proCountsLabel } from "../lib/pro-catalog";
import { hubs, hubItems, hubPath } from "../lib/hubs";
import { motionDrift } from "./sync-motion";

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
  /** The SwiftPieces Pro screen this piece grows into (a Pro registry id), shown as the upgrade path on its page. */
  pro: z.string().regex(/^[a-z0-9-]+$/).optional(),
  /** Day the piece shipped, as "YYYY-MM-DD" (quoted, so YAML keeps it a string). Drives the "New" badge. */
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * The "New" badge marks only the latest wave: pieces sharing the most recent `added` date, and only for
 * this many days after it (measured at registry build time). An earlier wave loses it when the next ships.
 */
const NEW_FOR_DAYS = 30;
const isRecent = (added: string) => Date.now() - Date.parse(`${added}T00:00:00Z`) < NEW_FOR_DAYS * 86_400_000;

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
  // Each piece carries its own copy of the motion sections it uses (registry/foundation/PieceMotion.swift).
  // A stale copy would ship old motion to the registry and the docs, so it stops the build.
  const drift = motionDrift();
  if (drift.length) throw new Error(`Piece motion blocks are out of date in ${drift.join(", ")}. Run \`npm run motion:sync\`.`);
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
        added: header.added,
        isNew: false, // set below, once the latest wave is known
        liquidGlass: /glassEffect|GlassEffectContainer|buttonStyle\(\.glass/.test(body),
        metal: shaders.length > 0 || /ShaderLibrary/.test(body),
      });
      items.push(item);
    }
  }
  const latestWave = items.reduce((max, i) => (i.added && i.added > max ? i.added : max), "");
  for (const i of items) i.isNew = Boolean(i.added) && i.added === latestWave && isRecent(latestWave);

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
  writeDocsIndex();
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
  writeFileSync(join(root, "index.mdx"), `---\ntitle: "All SwiftUI components"\ndescription: "Every free SwiftPieces component for iOS with a live preview. Filter by category, then open a piece for its notes, parameters, source and install command."\nindex: true\n---\n\n{/* GENERATED FILE. Edit scripts/build-registry.ts. */}\n`);
  // Explore Pro: Pro's screens, flows and templates as cards that open on pro.swiftpieces.com. The cards
  // come from lib/pro-cards.json and public/pro-cards/, refreshed by scripts/pro-cards/capture.ts.
  writeFileSync(join(root, "screens.mdx"), `---\ntitle: "Screens"\ndescription: "Production-ready SwiftUI screens from SwiftPieces Pro. Each one is a complete, themed screen you drop into your app and wire to your data."\npro: "screen"\n---\n\n{/* GENERATED FILE. Edit scripts/build-registry.ts. */}\n`);
  writeFileSync(join(root, "flows.mdx"), `---\ntitle: "Flows"\ndescription: "Whole journeys through SwiftPieces Pro's app templates: first run through sign in and the paywall, the core of each app, then profile and settings, screen by screen."\npro: "flow"\n---\n\n{/* GENERATED FILE. Edit scripts/build-registry.ts. */}\n`);
  writeFileSync(join(root, "templates.mdx"), `---\ntitle: "Templates"\ndescription: "Complete Xcode app templates from SwiftPieces Pro, wired end to end. Open the project, swap the brand and the copy, ship."\npro: "template"\n---\n\n{/* GENERATED FILE. Edit scripts/build-registry.ts. */}\n`);
  writeFileSync(join(root, "meta.json"), JSON.stringify({
    title: "Components",
    root: true,
    pages: ["index", "---Explore Pro---", ...exploreProPages, `---Categories · ${cats.length}---`, ...cats.map((c) => categories[c].slug)],
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
  writeFileSync(join(DOCS_DIR, "meta.json"), JSON.stringify({ title: "SwiftPieces", pages: ["introduction", "installation", "cli", "mcp", "liquid-glass", "guides", "components"] }, null, 2));
}

/**
 * registry/__registry__/docs.json: every docs page's URL, title, description, sidebar breadcrumbs and
 * searchable text, for the search route and the sitemap. They used to import lib/source.ts, the
 * compiled MDX (about 20 MB once every piece's Swift source is highlighted), and every server entry
 * that imports it carries its own copy into the Worker: three copies broke Cloudflare's 64 MiB
 * limit. Only the docs pages import lib/source.ts now. The URLs and breadcrumbs come from fumadocs'
 * loader over the same files, and the text from its structure() with the MDX parser, so search
 * returns what createFromSource(source) did.
 */
function writeDocsIndex() {
  const files: VirtualFile[] = [];
  const bodies = new Map<string, string>();
  // Breadth first, a folder's files before its subfolders, like the glob fumadocs-mdx reads the docs
  // with: equal search scores then rank in the same order.
  const queue = [DOCS_DIR];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = join(dir, entry.name), path = relative(DOCS_DIR, abs);
      if (entry.isDirectory()) queue.push(abs);
      else if (entry.name === "meta.json") files.push({ type: "meta", path, data: JSON.parse(readFileSync(abs, "utf8")) });
      else if (entry.name.endsWith(".mdx")) {
        const raw = readFileSync(abs, "utf8");
        const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
        const fm = (m ? parseYaml(m[1]) : {}) as { title?: string; description?: string };
        bodies.set(path, m ? raw.slice(m[0].length) : raw);
        files.push({ type: "page", path, data: { ...fm, title: fm.title ?? basename(entry.name, ".mdx") } });
      }
    }
  };
  while (queue.length) walk(queue.shift()!);
  const docs = loader({ baseUrl: "/docs", source: { files } });
  const tree = docs.getPageTree();
  const pages = docs.getPages().map((page) => ({
    url: page.url,
    title: page.data.title,
    description: page.data.description,
    breadcrumbs: breadcrumbs(tree, page.url),
    structuredData: structure(bodies.get(page.path) ?? "", [remarkMdx, remarkUnravel]),
  }));
  writeFileSync(join(OUT_DIR, "docs.json"), JSON.stringify(pages, null, 2));
}

/**
 * MDX's mark-and-unravel step, which its compiler runs before any remark plugin (so before fumadocs'
 * structure at build time): a paragraph holding only JSX, like a line of <Tab>s, becomes those
 * elements. Without it the index would hold text the docs search never had.
 */
type MdNode = { type: string; value?: string; children?: MdNode[] };
function remarkUnravel() {
  const walk = (parent: MdNode) => {
    const kids = parent.children ?? [];
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i];
      const inner = node.children ?? [];
      const onlyJsx = node.type === "paragraph"
        && inner.some((c) => c.type === "mdxJsxTextElement" || c.type === "mdxTextExpression")
        && inner.every((c) => c.type === "mdxJsxTextElement" || c.type === "mdxTextExpression" || (c.type === "text" && !c.value?.trim()));
      if (onlyJsx) {
        const lifted = inner.filter((c) => c.type !== "text").map((c) => ({ ...c, type: c.type === "mdxJsxTextElement" ? "mdxJsxFlowElement" : "mdxFlowExpression" }));
        kids.splice(i, 1, ...lifted);
        i--;
        continue;
      }
      walk(node);
    }
  };
  return (tree: MdNode) => walk(tree);
}

/** fumadocs' own breadcrumbs for search results: the names of the folders above a page in the sidebar tree. */
function breadcrumbs(tree: Root, url: string): string[] | undefined {
  const path = findPath(tree.children, (node) => node.type === "page" && node.url === url);
  if (!path) return undefined;
  path.pop();
  return [tree.name, ...path.map((node) => node.name)].filter((name): name is string => typeof name === "string" && name.length > 0);
}

/** Frontmatter and body of each guide, in the sidebar's order, for llms.txt and llms-full.txt. */
function readGuides(): { title: string; description: string; url: string; body: string }[] {
  const dir = join(DOCS_DIR, "guides");
  if (!existsSync(dir)) return [];
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as { pages: string[] };
  return meta.pages
    .filter((slug) => slug !== "index" && existsSync(join(dir, `${slug}.mdx`)))
    .map((slug) => {
      const raw = readFileSync(join(dir, `${slug}.mdx`), "utf8");
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
      const fm = (m ? parseYaml(m[1]) : {}) as { title?: string; description?: string };
      return { title: fm.title ?? slug, description: fm.description ?? "", url: `${SITE_URL}/docs/guides/${slug}`, body: m ? raw.slice(m[0].length).trim() : raw };
    });
}

function writeLlms(items: RegistryItem[]) {
  const byCat = new Map<string, RegistryItem[]>();
  for (const i of items) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
  const guides = readGuides();
  const catCount = new Set(items.map((i) => i.category)).size;
  const lines = [
    "# SwiftPieces",
    "",
    `> SwiftPieces (swiftpieces.com) is a free library of ${items.length} SwiftUI components for iOS in ${catCount} categories: animated, gesture-driven interactions such as a swipeable card stack, Liquid Glass (iOS 26) menus, a floating tab bar, interactive charts, form inputs and AI chat surfaces. Each piece is one self-contained Swift file (plus a .metal file where a shader is involved) on Apple frameworks only, from iOS 17. Install by copy-paste, \`npx swiftpieces add <Name>\`, or the SwiftPieces MCP server.`,
    "",
    "Key facts:",
    "",
    "- License: MIT + Commons Clause. Free for personal and commercial apps, including client work. Source-available rather than OSI open source: the pieces themselves may not be sold or redistributed.",
    "- No dependencies and no Swift package: the CLI copies source files into a SwiftPieces folder in the app, and they become the developer's own code.",
    "- iOS 17 baseline. Liquid Glass pieces gate glass with `#available(iOS 26, *)` and fall back to Material.",
    `- One motion language across every piece: five spring tiers with named roles, gesture releases that keep the finger's velocity, rubber-band limits and a Reduce Motion substitute for every movement (${SITE_URL}/docs/guides/swiftui-motion).`,
    "- States and accessibility are built in (Dynamic Type, Reduce Motion, Reduce Transparency), with haptics (sensoryFeedback) where an interaction calls for them.",
    `- Source: ${"https://github.com/Saivion/SwiftPieces"}`,
    "",
    "Rules for Liquid Glass: gate with `#available(iOS 26, *)` and a Material fallback; wrap multiple glass views in one `GlassEffectContainer`; apply `.glassEffect` after layout modifiers; respect `accessibilityReduceTransparency`; never use invented modifiers such as `.liquidGlassUltra`.",
    "",
    "## Docs",
    "",
    `- [Introduction](${SITE_URL}/docs/introduction)`,
    `- [Installation](${SITE_URL}/docs/installation)`,
    `- [CLI](${SITE_URL}/docs/cli)`,
    `- [MCP and agents](${SITE_URL}/docs/mcp)`,
    `- [SwiftUI Liquid Glass guide](${SITE_URL}/docs/liquid-glass)`,
    `- [Registry index (JSON)](${SITE_URL}/r/index.json)`,
    `- [Free MCP endpoint](${SITE_URL}/api/mcp): search_pieces, get_piece, install_piece, list_categories, get_liquid_glass_guide`,
    `- [Full text for LLMs](${SITE_URL}/llms-full.txt): every piece's notes and parameters, and every guide`,
    "",
    "## Tools",
    "",
    `- [App Library](${SITE_URL}/apps): App Store apps remixed as original SwiftUI screens to try, take apart and remix in the browser Playground. Three are free; the rest come with Pro.`,
    `- [Styles](${SITE_URL}/styles): make one style for every screen (accent, light and dark, iOS fonts, corners, cards, buttons, spacing, motion) on live SwiftUI components. A style travels as a short code (SP2-…) that the Playground's Style tab and its \`?style=\` links read, and exports as Theme.swift.`,
    "",
  ];
  if (guides.length) {
    lines.push("## Guides", "");
    for (const g of guides) lines.push(`- [${g.title}](${g.url}): ${g.description}`);
    lines.push("");
  }
  lines.push("## Collections", "");
  for (const h of hubs) lines.push(`- [${h.h1}](${SITE_URL}${hubPath(h.slug)}): ${h.description} (${hubItems(h, items).length} pieces)`);
  lines.push(
    "",
    "## SwiftPieces Pro",
    "",
    `A separate paid library for building whole apps: ${proCountsLabel} (production-ready SwiftUI screens, flows that string them into whole journeys from first run to settings, complete Xcode projects, and agent skills that build the rest in the same design) at ${PRO_URL}/library, plus Pro remixing in the Playground at ${SITE_URL}/apps (all ${proCatalog.remixing.apps} apps in the App Library, remix any app with AI, keep up to ${proCatalog.remixing.saves} remixes). One plan with lifetime access; plan and pricing: ${PRO_URL}/pro. Pro MCP endpoint: ${PRO_URL}/api/mcp (license key required): search_library, get_item, list_kit, get_kit_item, apply_design_skill, apply_recipe.`,
    "",
  );
  for (const [cat, list] of byCat) {
    lines.push(`## ${categories[cat as Category].title} (${SITE_URL}${hubPath(categories[cat as Category].slug)})`, "");
    for (const i of list) {
      lines.push(
        `- [${i.title}](${i.docs}): ${i.description} (iOS ${i.minIOSVersion}+${i.liquidGlass ? ", Liquid Glass" : ""}${i.metal ? ", Metal" : ""}). Install: \`npx swiftpieces add ${i.name}\`. Registry: ${SITE_URL}/r/${i.name}.json`,
      );
    }
    lines.push("");
  }
  mkdirSync(join(ROOT, "public"), { recursive: true });
  writeFileSync(join(ROOT, "public/llms.txt"), lines.join("\n"));
  writeLlmsFull(items, guides);
}

/**
 * llms-full.txt: the whole free library as one plain document for assistants that read a site in
 * one request. Each piece's summary, notes and parameters (not its source, which the registry
 * serves), then each guide in full.
 */
function writeLlmsFull(items: RegistryItem[], guides: ReturnType<typeof readGuides>) {
  const out = [
    "# SwiftPieces: full text",
    "",
    `> ${items.length} free SwiftUI components for iOS, one Swift file each, MIT + Commons Clause. Index: ${SITE_URL}/llms.txt. Source for any piece: ${SITE_URL}/r/<Name>.json or its docs page.`,
    "",
    "# Components",
    "",
  ];
  for (const item of items) {
    const docs = extractDocs(item.files[0].content ?? "");
    const sidecar = join(SWIFT_DIR, item.category, `${item.name}.mdx`);
    const prose = existsSync(sidecar) ? readFileSync(sidecar, "utf8").trim() : "";
    out.push(
      `## ${item.title} (\`${item.name}\`)`,
      "",
      `URL: ${item.docs}`,
      `Category: ${categories[item.category].title}. iOS ${item.minIOSVersion}+${item.liquidGlass ? ". Liquid Glass on iOS 26 with a Material fallback" : ""}${item.metal ? ". Metal shader" : ""}.`,
      `Files: ${[...item.files, ...item.shaders].map((f) => basename(f.target)).join(", ")}`,
      `Install: npx swiftpieces add ${item.name}`,
      "",
      item.description,
      "",
      ...(docs.summary ? [docs.summary, ""] : []),
      ...(prose ? [prose.replace(/^## /gm, "### "), ""] : []),
      ...(docs.params.length ? ["### Parameters", "", ...docs.params.map((p) => `- \`${p.name}\`: ${p.text}`), ""] : []),
    );
  }
  if (guides.length) {
    out.push("# Guides", "");
    for (const g of guides) out.push(`## ${g.title}`, "", `URL: ${g.url}`, "", g.body.replace(/^(#{2,5}) /gm, "#$1 "), "");
  }
  writeFileSync(join(ROOT, "public/llms-full.txt"), out.join("\n"));
}

function writeSchema() {
  mkdirSync(join(ROOT, "public/schema"), { recursive: true });
  const schema = z.toJSONSchema(registryItemSchema, { target: "draft-7" });
  writeFileSync(
    join(ROOT, "public/schema/registry-item.json"),
    JSON.stringify({ $id: `${SITE_URL}/schema/registry-item.json`, title: "SwiftPieces registry item", ...schema }, null, 2),
  );
}

build();
