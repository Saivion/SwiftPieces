import { infoRefs } from "@/lib/xcode-repo";

// Git's first request in a clone: which branches exist. See lib/xcode-repo.ts.
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ blob: string; repo: string }> }) {
  const { blob, repo } = await ctx.params;
  return infoRefs(req, blob, repo);
}
