import { getBlock, getBlocks, getRegistryIndex, getRegistryItem } from "@/lib/registry";
import { loadFullBlock, loadFullRegistryItem } from "@/lib/registry-items";

// Public registry protocol. /r/[name].json rewrites here. Everything in the
// free registry is open source, so this route is fully static and unauthenticated.
export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ name: "index" }, ...getRegistryIndex().map((i) => ({ name: i.name })), ...getBlocks().map((b) => ({ name: b.name }))];
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const clean = name.replace(/\.json$/, "");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    "Access-Control-Allow-Origin": "*",
  };

  // The index lists pieces, then blocks (`type: "registry:block"`), so `npx swiftpieces list` shows both.
  if (clean === "index") return new Response(JSON.stringify([...getRegistryIndex(), ...getBlocks()]), { headers });

  const entry = getRegistryItem(clean);
  // A block installs like a piece; its registryDependencies bring the pieces it is built from.
  const item = entry ? await loadFullRegistryItem(entry.name) : getBlock(clean) ? await loadFullBlock(clean) : null;
  if (!item) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(item), { headers });
}
