import { createMcpHandler } from "@/lib/mcp/server";
import { getBlocks, getProBlocks, getRegistryIndex, getRegistryItem, cliCommand } from "@/lib/registry";
import { loadFullBlock, loadFullRegistryItem } from "@/lib/registry-items";
import { blockCategoryIds, proBlockUrl } from "@/lib/blocks";
import { pro, site } from "@/lib/site";
import { categoryIds } from "@/lib/categories";
import { getSkill, referenceUri, skillText, skillUri } from "@/lib/skills";

// Free MCP: public, no auth, free tools only (Rev 3 §9). Pro tools live on pro.swiftpieces.com/api/mcp.
const glassGuide = `Liquid Glass rules for SwiftUI (iOS 26):
1. Gate with #available(iOS 26, *) and provide a Material fallback in the else branch.
2. Respect @Environment(\\.accessibilityReduceTransparency): use an opaque surface when it is on.
3. Wrap sibling glass views in one GlassEffectContainer(spacing:) so they render as one layer and can morph.
4. Apply .glassEffect after layout and appearance modifiers.
5. Pair .glassEffectID(_:in:) with a @Namespace to morph between shapes.
6. Only real APIs: glassEffect(_:in:), Glass.regular/.clear/.identity, .tint(_:), .interactive(_:), GlassEffectContainer, glassEffectID, glassEffectUnion, .buttonStyle(.glass), .glassProminent. Never .liquidGlassUltra.
Guide: ${site.url}/docs/liquid-glass`;

const appDesign = getSkill("swiftpieces-tool-app-design");
if (!appDesign) throw new Error("skills.json has no swiftpieces-tool-app-design. Run npm run registry:build.");
const DESIGN_TOOL = "get_design_skill";

export const POST = createMcpHandler({
  name: "swiftpieces",
  version: "0.2.0",
  instructions: `SwiftPieces: free SwiftUI pieces (single designed interactions) and blocks (whole sections of a screen built from pieces), plus App Design, a free design method for any SwiftUI app, with or without SwiftPieces.

When asked to build, design or improve iPhone UI, work in this order:
1. Method: load App Design first (the ${DESIGN_TOOL} tool, the app-design prompt, or the resource ${skillUri(appDesign)}) and follow it. Load a reference only when the skill points to it.
2. Study: if a screen research server (Mobbin, Appllama) is connected, study real apps for the screen type before writing UI.
3. Reuse: search_pieces and search_blocks for a piece that already does the job before writing your own; install_piece returns the files and their dependencies.
4. Build and verify: compose the screen, then run the skill's pre-flight counts and simulator loop. A screen isn't done until it has been seen running, in light and dark mode.

For SwiftPieces Pro screens, patterns, flows and app templates, and the Build Kit, use the Pro server at ${pro.mcp} with a license key.`,
  prompts: [
    {
      name: "app-design",
      title: "App Design",
      description: appDesign.description,
      arguments: [{ name: "task", description: "The screen, flow or app to build or improve", required: false }],
      handler: ({ task }) => `${skillText(appDesign, DESIGN_TOOL)}\n\n---\n\nFollow the skill above${task ? ` for this task: ${task}` : " for my next request"}.`,
    },
  ],
  resources: [
    { uri: skillUri(appDesign), name: appDesign.name, title: `${appDesign.title} skill`, description: appDesign.description, mimeType: "text/markdown", read: () => skillText(appDesign, DESIGN_TOOL) },
    ...appDesign.references.map((r) => ({ uri: referenceUri(appDesign, r), name: `${appDesign.name}/${r.id}`, title: `${appDesign.title}: ${r.title}`, description: `A reference for the ${appDesign.title} skill: ${r.title}.`, mimeType: "text/markdown", read: () => r.body })),
    { uri: "swiftpieces://guides/liquid-glass", name: "liquid-glass", title: "Liquid Glass rules", description: "The rules for correct Liquid Glass adoption with verified iOS 26 API names.", mimeType: "text/markdown", read: () => glassGuide },
  ],
  tools: [
    {
      name: DESIGN_TOOL,
      description: `${appDesign.title}: the free SwiftPieces design method for any SwiftUI app. Load it before building, designing or polishing iPhone UI (screens, flows, onboarding, paywalls, navigation, motion), then follow it. Pass reference to read one of its references when the skill points to it.`,
      inputSchema: { type: "object", properties: { reference: { type: "string", enum: appDesign.references.map((r) => r.id), description: "Omit for the skill itself" } } },
      handler: ({ reference }) => {
        if (!reference) return skillText(appDesign, DESIGN_TOOL);
        const ref = appDesign.references.find((r) => r.id === reference);
        if (!ref) throw new Error(`No reference "${reference}". Use one of: ${appDesign.references.map((r) => r.id).join(", ")}.`);
        return ref.body;
      },
    },
    {
      name: "search_pieces",
      description: "Search the free SwiftPieces registry by keyword, optionally filtered by category or minimum iOS version.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string", enum: [...categoryIds] }, maxIOS: { type: "string", description: "Only pieces whose minIOSVersion is at most this, e.g. 17.0" } } },
      handler: ({ query, category, maxIOS }) => {
        const q = String(query ?? "").toLowerCase();
        return getRegistryIndex()
          .filter((i) => !category || i.category === category)
          .filter((i) => !maxIOS || parseFloat(i.minIOSVersion) <= parseFloat(String(maxIOS)))
          .filter((i) => !q || [i.name, i.title, i.description, ...i.tags].join(" ").toLowerCase().includes(q))
          .map(({ name, title, description, category, minIOSVersion, liquidGlass, metal, docs }) => ({ name, title, description, category, minIOSVersion, liquidGlass, metal, docs }));
      },
    },
    {
      name: "search_blocks",
      description: "Search SwiftPieces patterns, also called blocks (whole sections of a screen such as a chat thread, a prompt composer, a tab bar, a settings group, a form, a sheet, sign in or checkout), by keyword, optionally by category. Every pattern is in SwiftPieces Pro and installs from the Pro server; a free block, should one ship, installs with get_piece/install_piece.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, category: { type: "string", enum: [...blockCategoryIds] } } },
      handler: ({ query, category }) => {
        const q = String(query ?? "").toLowerCase();
        const match = (text: string) => !q || text.toLowerCase().includes(q);
        const free = getBlocks()
          .filter((b) => !category || b.category === category)
          .filter((b) => match([b.name, b.title, b.description, ...b.tags].join(" ")))
          .map(({ name, title, description, category, minIOSVersion, registryDependencies, docs }) => ({ name, title, description, category, minIOSVersion, builtFrom: registryDependencies, docs, availability: "free" }));
        const paid = getProBlocks()
          .filter((p) => !category || p.category === category)
          .filter((p) => match([p.name, p.title, p.summary, p.description].join(" ")))
          .map(({ name, title, summary, category, parts, id }) => ({ name, title, description: summary, category, inside: parts, availability: "pro", pro: proBlockUrl(id) }));
        return [...free, ...paid];
      },
    },
    {
      name: "get_piece",
      description: "Return a free piece's or free block's full source, shaders, metadata and docs URL. A block lists the pieces it is built from in registryDependencies.",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      handler: async ({ name }) => {
        const item = (await loadFullRegistryItem(String(name))) ?? (await loadFullBlock(String(name)));
        if (!item) throw new Error(`No free piece or block named "${name}". If it is a Pro screen, pattern, flow or template, use the Pro MCP at ${pro.mcp}.`);
        return item;
      },
    },
    {
      name: "install_piece",
      description: "Return the files to write (path + content) so the agent can install a piece or block into an Xcode 16 synchronized folder, plus the equivalent CLI command. For a block, also install each name in registryDependencies (the pieces it is built from).",
      inputSchema: { type: "object", properties: { name: { type: "string" }, projectPath: { type: "string", description: "Absolute path to the app source folder that contains SwiftPieces/" } }, required: ["name"] },
      handler: async ({ name, projectPath }) => {
        const item = (await loadFullRegistryItem(String(name))) ?? (await loadFullBlock(String(name)));
        if (!item) throw new Error(`No free piece or block named "${name}".`);
        const base = projectPath ? String(projectPath).replace(/\/$/, "") : ".";
        const files = [...item.files, ...item.shaders, ...item.assets].map((f) => ({ path: `${base}/${f.target}`, content: f.content }));
        return { command: cliCommand(item), files, requirements: { infoPlist: item.infoPlist, capabilities: item.requiredCapabilities, spm: item.spmDependencies }, registryDependencies: item.registryDependencies };
      },
    },
    {
      name: "list_categories",
      description: "List free piece categories and pattern categories with counts, and links to the SwiftPieces Pro library (screens, patterns, flows and app templates).",
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        const counts: Record<string, number> = {};
        for (const i of getRegistryIndex()) counts[i.category] = (counts[i.category] ?? 0) + 1;
        const blocks: Record<string, { free: number; pro: number }> = {};
        for (const b of getBlocks()) (blocks[b.category] ??= { free: 0, pro: 0 }).free += 1;
        for (const p of getProBlocks()) (blocks[p.category] ??= { free: 0, pro: 0 }).pro += 1;
        return { free: counts, blocks, pro: { library: pro.library, screens: pro.screens, patterns: pro.patterns, flows: pro.flows, templates: pro.templates, mcp: pro.mcp } };
      },
    },
    {
      name: "get_liquid_glass_guide",
      description: "The rules for correct Liquid Glass adoption with verified iOS 26 API names.",
      inputSchema: { type: "object", properties: {} },
      handler: () => glassGuide,
    },
  ],
});

// Streamable HTTP clients GET here to open a server-to-client event stream. We don't offer one,
// and the spec's answer is 405: anything else (a 200 that ends at once) reads as a dropped stream
// and the client reconnects in a loop. Browsers and people still get the endpoint's description.
export function GET(req: Request) {
  if (req.headers.get("accept")?.includes("text/event-stream")) return new Response(null, { status: 405, headers: { Allow: "POST" } });
  return Response.json({ name: "swiftpieces", transport: "streamable-http", endpoint: `${site.url}/api/mcp`, pro: pro.mcp });
}
