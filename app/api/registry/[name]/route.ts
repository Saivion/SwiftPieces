import { getRegistryIndex, getRegistryItem, loadFullRegistryItem } from "@/lib/registry";

// Public registry protocol. /r/[name].json rewrites here. Everything in the
// free registry is open source, so this route is fully static and unauthenticated.
export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ name: "index" }, ...getRegistryIndex().map((i) => ({ name: i.name }))];
}

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const clean = name.replace(/\.json$/, "");
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    "Access-Control-Allow-Origin": "*",
  };

  if (clean === "index") return new Response(JSON.stringify(getRegistryIndex()), { headers });

  const entry = getRegistryItem(clean);
  if (!entry) return new Response("Not found", { status: 404 });
  const item = await loadFullRegistryItem(entry.name);
  if (!item) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(item), { headers });
}
