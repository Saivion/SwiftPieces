import { createMcpHandler } from "@/lib/mcp/server";
import { getRegistryIndex, getRegistryItem, loadFullRegistryItem, cliCommand } from "@/lib/registry";
import { pro, site } from "@/lib/site";
import { categoryIds } from "@/lib/categories";

// Free MCP: public, no auth, free tools only (Rev 3 §9). Pro tools live on pro.swiftpieces.com/api/mcp.
const glassGuide = `Liquid Glass rules for SwiftUI (iOS 26):
1. Gate with #available(iOS 26, *) and provide a Material fallback in the else branch.
2. Respect @Environment(\\.accessibilityReduceTransparency): use an opaque surface when it is on.
3. Wrap sibling glass views in one GlassEffectContainer(spacing:) so they render as one layer and can morph.
4. Apply .glassEffect after layout and appearance modifiers.
5. Pair .glassEffectID(_:in:) with a @Namespace to morph between shapes.
6. Only real APIs: glassEffect(_:in:), Glass.regular/.clear/.identity, .tint(_:), .interactive(_:), GlassEffectContainer, glassEffectID, glassEffectUnion, .buttonStyle(.glass), .glassProminent. Never .liquidGlassUltra.
Guide: ${site.url}/docs/liquid-glass`;

export const POST = createMcpHandler({
  name: "swiftpieces",
  version: "0.1.0",
  instructions: `Search and install free Swift Pieces (MIT + Commons Clause). For Swift Pieces Pro screens and app templates use the Pro server at ${pro.mcp} with a license key.`,
  tools: [
    {
      name: "search_pieces",
      description: "Search the free Swift Pieces registry by keyword, optionally filtered by category or minimum iOS version.",
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
      name: "get_piece",
      description: "Return a free piece's full source, shaders, metadata and docs URL.",
      inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
      handler: async ({ name }) => {
        const item = await loadFullRegistryItem(String(name));
        if (!item) throw new Error(`No free piece named "${name}". If it is a Pro screen or template, use the Pro MCP at ${pro.mcp}.`);
        return item;
      },
    },
    {
      name: "install_piece",
      description: "Return the files to write (path + content) so the agent can install a piece into an Xcode 16 synchronized folder, plus the equivalent CLI command.",
      inputSchema: { type: "object", properties: { name: { type: "string" }, projectPath: { type: "string", description: "Absolute path to the app source folder that contains SwiftPieces/" } }, required: ["name"] },
      handler: async ({ name, projectPath }) => {
        const item = await loadFullRegistryItem(String(name));
        if (!item) throw new Error(`No free piece named "${name}".`);
        const base = projectPath ? String(projectPath).replace(/\/$/, "") : ".";
        const files = [...item.files, ...item.shaders, ...item.assets].map((f) => ({ path: `${base}/${f.target}`, content: f.content }));
        return { command: cliCommand(item), files, requirements: { infoPlist: item.infoPlist, capabilities: item.requiredCapabilities, spm: item.spmDependencies }, registryDependencies: item.registryDependencies };
      },
    },
    {
      name: "list_categories",
      description: "List free categories with counts, and links to the Swift Pieces Pro library (screens and app templates).",
      inputSchema: { type: "object", properties: {} },
      handler: () => {
        const counts: Record<string, number> = {};
        for (const i of getRegistryIndex()) counts[i.category] = (counts[i.category] ?? 0) + 1;
        return { free: counts, pro: { library: pro.library, screens: pro.screens, templates: pro.templates, mcp: pro.mcp } };
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

export function GET() {
  return Response.json({ name: "swiftpieces", transport: "streamable-http", endpoint: `${site.url}/api/mcp`, pro: pro.mcp });
}
